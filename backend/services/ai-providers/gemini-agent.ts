// Google Gemini tool-use adapter. Translates neutral agent messages to the
// generateContent `functionCall` / `functionResponse` format.
//
// Gemini matches tool results to calls by function NAME (no call id), so the
// neutral ToolResultMsg carries `name`, and we synthesize stable ids on the way
// out (`<name>__<index>`).
import axios from "axios";
import type { AgentMessage, ProviderAdapter, ToolCall } from "./types";

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function toGeminiContents(messages: AgentMessage[]) {
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  for (const m of messages) {
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.input ?? {} } });
      }
      contents.push({ role: "model", parts });
    } else {
      contents.push({
        role: "user",
        parts: m.results.map((r) => ({
          functionResponse: {
            name: r.name,
            response: r.isError ? { error: r.content } : { result: r.content },
          },
        })),
      });
    }
  }
  return contents;
}

export const geminiAdapter: ProviderAdapter = async (params, onText) => {
  const url = `${params.baseUrl.replace(/\/$/, "")}/models/${params.model}:generateContent`;
  const { data } = await axios.post(
    url,
    {
      systemInstruction: { parts: [{ text: params.system }] },
      contents: toGeminiContents(params.messages),
      tools: [
        {
          functionDeclarations: params.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ],
      generationConfig: { maxOutputTokens: params.maxTokens, temperature: 0.2 },
    },
    {
      headers: { "Content-Type": "application/json", "x-goog-api-key": params.apiKey },
      signal: params.signal,
      timeout: 180_000,
    },
  );

  const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  const toolCalls: ToolCall[] = [];
  parts.forEach((part, i) => {
    if ("text" in part) text += part.text ?? "";
    else if ("functionCall" in part) {
      toolCalls.push({
        id: `${part.functionCall.name}__${i}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  });
  if (text) onText?.(text);

  return {
    text,
    toolCalls,
    done: toolCalls.length === 0,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
};

export const __gemini_internal = { toGeminiContents };
