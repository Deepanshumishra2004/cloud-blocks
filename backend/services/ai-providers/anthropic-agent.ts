// Anthropic tool-use adapter. Translates neutral agent messages to the
// Messages API `tool_use` / `tool_result` block format and back.
import axios from "axios";
import type { AgentMessage, ProviderAdapter, ToolCall } from "./types";

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

function toAnthropicMessages(messages: AgentMessage[]) {
  return messages.map((m) => {
    if (m.role === "user") {
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

export const anthropicAdapter: ProviderAdapter = async (params, onText) => {
  const { data } = await axios.post(
    `${params.baseUrl.replace(/\/$/, "")}/v1/messages`,
    {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: toAnthropicMessages(params.messages),
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
      timeout: 180_000,
    },
  );

  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of data.content ?? []) {
    if (block.type === "text") text += block.text ?? "";
    else if (block.type === "tool_use") {
      toolCalls.push({ id: block.id, name: block.name, input: block.input ?? {} });
    }
  }
  if (text) onText?.(text);

  return {
    text,
    toolCalls,
    done: toolCalls.length === 0,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
};
