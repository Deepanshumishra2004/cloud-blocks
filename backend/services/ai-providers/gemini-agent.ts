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
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function toGeminiContents(messages: AgentMessage[]) {
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  for (const m of messages) {
    if (m.role === "user") {
      const parts: GeminiPart[] = [];
      for (const img of m.images ?? []) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
      if (m.content || parts.length === 0) parts.push({ text: m.content });
      contents.push({ role: "user", parts });
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

// Streaming via streamGenerateContent (alt=sse): each SSE event is a partial
// GenerateContentResponse. Text parts are forwarded to onText as they arrive;
// functionCall parts are collected (Gemini emits them whole, not fragmented).
export const geminiAdapter: ProviderAdapter = async (params, onText) => {
  const url = `${params.baseUrl.replace(/\/$/, "")}/models/${params.model}:streamGenerateContent?alt=sse`;
  const { data: stream } = await axios.post(
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
      responseType: "stream",
      timeout: 180_000,
    },
  );

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCalls: ToolCall[] = [];
  let fnIndex = 0;

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

        const parts: GeminiPart[] = evt.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if ("text" in part) {
            const t = part.text ?? "";
            text += t;
            if (t) onText?.(t);
          } else if ("functionCall" in part) {
            toolCalls.push({
              id: `${part.functionCall.name}__${fnIndex++}`,
              name: part.functionCall.name,
              input: part.functionCall.args ?? {},
            });
          }
        }

        if (evt.usageMetadata) {
          inputTokens = evt.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = evt.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
      }
    }
  } catch (err) {
    // Mid-stream failure after partial output: replaying would duplicate it.
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

export const __gemini_internal = { toGeminiContents };
