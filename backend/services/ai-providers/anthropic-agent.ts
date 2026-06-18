// Anthropic tool-use adapter. Translates neutral agent messages to the
// Messages API `tool_use` / `tool_result` block format and back.
import axios from "axios";
import type { AgentMessage, ProviderAdapter, ToolCall } from "./types";

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

function toAnthropicMessages(messages: AgentMessage[]) {
  return messages.map((m) => {
    if (m.role === "user") {
      if (m.images?.length) {
        const blocks: AnthropicBlock[] = m.images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: img.data },
        }));
        if (m.content) blocks.push({ type: "text", text: m.content });
        return { role: "user", content: blocks };
      }
      return { role: "user", content: m.content };
    }
    if (m.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      return { role: "assistant", content: blocks };
    }
    // tool results
    const blocks: AnthropicBlock[] = m.results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.id,
      content: r.content,
      ...(r.isError ? { is_error: true } : {}),
    }));
    return { role: "user", content: blocks };
  });
}

// Streaming Messages API: text deltas are forwarded to onText as they arrive
// (typewriter effect in the UI); tool_use input JSON is assembled per block.
export const anthropicAdapter: ProviderAdapter = async (params, onText) => {
  const { data: stream } = await axios.post(
    `${params.baseUrl.replace(/\/$/, "")}/v1/messages`,
    {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: toAnthropicMessages(params.messages),
      stream: true,
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    },
    {
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      signal: params.signal,
      responseType: "stream",
      timeout: 180_000,
    },
  );

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  // Per-block scratch keyed by content_block index.
  const blocks = new Map<number, { type: string; id?: string; name?: string; json: string }>();
  const toolCalls: ToolCall[] = [];

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

      switch (evt.type) {
        case "message_start":
          inputTokens = evt.message?.usage?.input_tokens ?? 0;
          break;
        case "content_block_start":
          blocks.set(evt.index, {
            type: evt.content_block?.type ?? "text",
            id: evt.content_block?.id,
            name: evt.content_block?.name,
            json: "",
          });
          break;
        case "content_block_delta":
          if (evt.delta?.type === "text_delta") {
            const t = evt.delta.text ?? "";
            text += t;
            if (t) onText?.(t);
          } else if (evt.delta?.type === "input_json_delta") {
            const b = blocks.get(evt.index);
            if (b) b.json += evt.delta.partial_json ?? "";
          }
          break;
        case "content_block_stop": {
          const b = blocks.get(evt.index);
          if (b && b.type === "tool_use" && b.id && b.name) {
            let input: Record<string, unknown> = {};
            try { input = b.json ? JSON.parse(b.json) : {}; } catch { input = {}; }
            toolCalls.push({ id: b.id, name: b.name, input });
          }
          break;
        }
        case "message_delta":
          outputTokens = evt.usage?.output_tokens ?? outputTokens;
          break;
      }
    }
    }
  } catch (err) {
    // Mid-stream failure after partial output: don't let the agent loop retry
    // (it would replay the already-streamed text). Surface as a non-retryable
    // error only if we'd actually duplicate output.
    if (text.length > 0 || toolCalls.length > 0) {
      (err as { noRetry?: boolean }).noRetry = true;
    }
    throw err;
  }

  return {
    text,
    toolCalls,
    done: toolCalls.length === 0,
    usage: { inputTokens, outputTokens },
  };
};
