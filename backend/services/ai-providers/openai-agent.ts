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

  const { data } = await axios.post(
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
    },
    { headers, signal: params.signal, timeout: 180_000 },
  );

  const choice = data.choices?.[0];
  const message = choice?.message ?? {};
  const text: string = message.content ?? "";
  if (text) onText?.(text);

  const rawCalls: OpenAIToolCall[] = message.tool_calls ?? [];
  const toolCalls: ToolCall[] = rawCalls.map((c, i) => ({
    id: c.id || `call_${i}`,
    name: c.function?.name ?? "",
    input: parseArgs(c.function?.arguments ?? "{}"),
  }));

  return {
    text,
    toolCalls,
    done: toolCalls.length === 0,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
};
