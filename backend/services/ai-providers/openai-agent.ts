// OpenAI-compatible tool-use adapter. Covers OpenAI, OpenRouter, DeepSeek, and
// the OpenAI-compatible Chinese providers (Qwen, Zhipu GLM, Moonshot Kimi,
// MiniMax) — they differ only by baseUrl + model, supplied by the registry.
import axios from "axios";
import type { AgentMessage, ProviderAdapter, ToolCall } from "./types";

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

function toOpenAIMessages(system: string, messages: AgentMessage[]) {
  const out: Array<Record<string, unknown>> = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") {
      if (m.images?.length) {
        const parts: Array<Record<string, unknown>> = m.images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        }));
        if (m.content) parts.push({ type: "text", text: m.content });
        out.push({ role: "user", content: parts });
      } else {
        out.push({ role: "user", content: m.content });
      }
    } else if (m.role === "assistant") {
      const toolCalls: OpenAIToolCall[] = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
      }));
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
    } else {
      for (const r of m.results) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    }
  }
  return out;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

// Streaming Chat Completions: text deltas are forwarded to onText as they
// arrive; tool_call argument fragments are accumulated by their `index` since
// providers split a single call's JSON across many delta chunks.
export const openaiAdapter: ProviderAdapter = async (params, onText) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiKey}`,
    "Content-Type": "application/json",
  };
  // OpenRouter etiquette headers (harmless elsewhere).
  if (params.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://cloudblocks.local";
    headers["X-Title"] = "CloudBlocks";
  }

  const { data: stream } = await axios.post(
    `${params.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: toOpenAIMessages(params.system, params.messages),
      tools: params.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto",
      stream: true,
      stream_options: { include_usage: true },
    },
    { headers, signal: params.signal, responseType: "stream", timeout: 180_000 },
  );

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  // Tool calls assembled by streamed `index`; arguments arrive as JSON fragments.
  const calls = new Map<number, { id: string; name: string; args: string }>();

  let buffer = "";
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt: any;
        try { evt = JSON.parse(payload); } catch { continue; }

        if (evt.usage) {
          inputTokens = evt.usage.prompt_tokens ?? inputTokens;
          outputTokens = evt.usage.completion_tokens ?? outputTokens;
        }

        const delta = evt.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          onText?.(delta.content);
        }

        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const cur = calls.get(idx) ?? { id: "", name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          calls.set(idx, cur);
        }
      }
    }
  } catch (err) {
    // Mid-stream failure after partial output: replaying would duplicate it.
    if (text.length > 0 || calls.size > 0) {
      (err as { noRetry?: boolean }).noRetry = true;
    }
    throw err;
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, c]) => ({
      id: c.id || `call_${idx}`,
      name: c.name,
      input: parseArgs(c.args || "{}"),
    }));

  return {
    text,
    toolCalls,
    done: toolCalls.length === 0,
    usage: { inputTokens, outputTokens },
  };
};
