import crypto from "crypto";
import axios from "axios";
import type { AxiosResponse } from "axios";
import type { IncomingMessage } from "http";
import { env } from "../config/env";

// ── Provider registry ─────────────────────────────────────────────────────────

export const AI_PROVIDERS = ["GEMINI", "OPENAI", "ANTHROPIC", "DEEPSEEK"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const PROVIDER_MODELS: Record<AiProvider, string> = {
  GEMINI:    "gemini-2.5-flash",
  OPENAI:    "gpt-4o",
  ANTHROPIC: "claude-sonnet-4-6",
  DEEPSEEK:  "deepseek-chat",
};

// ── Crypto helpers ─────────────────────────────────────────────────────────────

function getEncryptionKey(secret: string): Buffer {
  if (secret.length !== 32) throw new Error("AI_CREDENTIAL_SECRET must be exactly 32 characters long");
  return Buffer.from(secret, "utf-8");
}

export function encryptApiKey(apiKey: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptApiKey(payload: string, secret: string): string {
  const [ivPart, authTagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !authTagPart || !encryptedPart) throw new Error("Stored API key is malformed");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(secret), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64")), decipher.final()]).toString("utf-8");
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "*".repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function getRequiredAiCredentialSecret(): string {
  if (!env.AI_CREDENTIAL_SECRET) throw new Error("AI credentials are not configured on the server");
  return env.AI_CREDENTIAL_SECRET;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ConversationMessage = { role: "user" | "assistant"; content: string };

type AiParams = {
  provider: AiProvider;
  apiKey: string;
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
  fileTree?: string;
  relatedFiles?: Array<{ path: string; content: string }>;
  history?: ConversationMessage[];
};

const MAX_FILE_LINES = 600;

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystem(params: Pick<AiParams, "filePath" | "currentContent" | "replType" | "fileTree" | "relatedFiles">): string {
  const parts: string[] = [
    `You are an expert coding assistant inside a cloud REPL (type: ${params.replType}).`,
    "",
    "Always respond with a single JSON object — no markdown, no text outside the JSON.",
    'Schema: { "type": "chat"|"code"|"mixed", "message": string|null, "edits": Edit[]|null }',
    'where Edit = { "search": string, "replace": string }',
    "",
    "Type rules:",
    '- "chat"  → explanation only, no code changes.',
    '- "code"  → code change. message may be a brief summary.',
    '- "mixed" → code change AND explanation.',
    "",
    "Edit rules:",
    "- search: copy the EXACT lines from the file you want to replace (including indentation).",
    "- replace: the new content (empty string to delete lines).",
    "- Each search block must be unique in the file — include enough context to disambiguate.",
    "- Only include blocks that actually change. Preserve the file's existing code style.",
  ];

  if (params.fileTree) parts.push("", "Project file tree:", params.fileTree);

  if (params.relatedFiles?.length) {
    parts.push("", "Related files for context (do not rewrite these):");
    for (const f of params.relatedFiles) parts.push(`--- ${f.path} ---`, f.content);
  }

  const fileLines = params.currentContent.split("\n");
  const fileSection =
    fileLines.length > MAX_FILE_LINES
      ? fileLines.slice(0, MAX_FILE_LINES).join("\n") +
        `\n// ... (${fileLines.length - MAX_FILE_LINES} lines truncated — only edit lines within the shown range)`
      : params.currentContent;

  parts.push("", `Target file: ${params.filePath}`, "", "File contents:", fileSection);
  return parts.join("\n");
}

function buildMessages(params: Pick<AiParams, "prompt" | "history">): ConversationMessage[] {
  return [...(params.history ?? []), { role: "user", content: params.prompt }];
}

// ── SSE stream parser ─────────────────────────────────────────────────────────

async function* parseNodeStream(stream: IncomingMessage, extractText: (line: string) => string | null): AsyncGenerator<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += (chunk as Buffer).toString("utf-8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const text = extractText(line);
      if (text !== null) yield text;
    }
  }
  // flush remaining buffer
  if (buffer.trim()) {
    const text = extractText(buffer);
    if (text !== null) yield text;
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────────

type GeminiChunk = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

function geminiExtract(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json || json === "[DONE]") return null;
  try {
    const chunk = JSON.parse(json) as GeminiChunk;
    return chunk.candidates?.flatMap((c) => c.content?.parts ?? []).map((p) => p.text ?? "").join("") || null;
  } catch { return null; }
}

async function* streamGemini(apiKey: string, system: string, messages: ConversationMessage[]): AsyncGenerator<string> {
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const response: AxiosResponse<IncomingMessage> = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_MODELS.GEMINI}:streamGenerateContent?alt=sse`,
    { contents: [{ role: "user", parts: [{ text: system }] }, ...contents], generationConfig: { temperature: 0.2 } },
    { headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, responseType: "stream" },
  );
  yield* parseNodeStream(response.data, geminiExtract);
}

async function generateGemini(apiKey: string, system: string, messages: ConversationMessage[]) {
  type GeminiResp = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const { data } = await axios.post<GeminiResp>(
    `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_MODELS.GEMINI}:generateContent`,
    { contents: [{ role: "user", parts: [{ text: system }] }, ...contents], generationConfig: { temperature: 0.2 } },
    { headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey } },
  );
  const text = data.candidates?.flatMap((c) => c.content?.parts ?? []).map((p) => p.text ?? "").join("").trim() ?? "";
  return { text, promptTokens: data.usageMetadata?.promptTokenCount ?? 0, completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0 };
}

// ── OpenAI-compatible (OpenAI + DeepSeek) ─────────────────────────────────────

type OpenAIChunk = { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }> };
type OpenAIResp  = { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };

const OPENAI_BASES: Partial<Record<AiProvider, string>> = {
  OPENAI:   "https://api.openai.com/v1",
  DEEPSEEK: "https://api.deepseek.com/v1",
};

function openAIExtract(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json || json === "[DONE]") return null;
  try {
    const chunk = JSON.parse(json) as OpenAIChunk;
    return chunk.choices?.[0]?.delta?.content ?? null;
  } catch { return null; }
}

async function* streamOpenAI(provider: "OPENAI" | "DEEPSEEK", apiKey: string, system: string, messages: ConversationMessage[]): AsyncGenerator<string> {
  const response: AxiosResponse<IncomingMessage> = await axios.post(
    `${OPENAI_BASES[provider]}/chat/completions`,
    { model: PROVIDER_MODELS[provider], messages: [{ role: "system", content: system }, ...messages], stream: true, temperature: 0.2 },
    { headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, responseType: "stream" },
  );
  yield* parseNodeStream(response.data, openAIExtract);
}

async function generateOpenAI(provider: "OPENAI" | "DEEPSEEK", apiKey: string, system: string, messages: ConversationMessage[]) {
  const { data } = await axios.post<OpenAIResp>(
    `${OPENAI_BASES[provider]}/chat/completions`,
    { model: PROVIDER_MODELS[provider], messages: [{ role: "system", content: system }, ...messages], temperature: 0.2 },
    { headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" } },
  );
  return { text: data.choices?.[0]?.message?.content ?? "", promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 };
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

type AnthropicChunk = { type?: string; delta?: { type?: string; text?: string } };
type AnthropicResp  = { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };

function anthropicExtract(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json) return null;
  try {
    const chunk = JSON.parse(json) as AnthropicChunk;
    if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") return chunk.delta.text ?? null;
    return null;
  } catch { return null; }
}

async function* streamAnthropic(apiKey: string, system: string, messages: ConversationMessage[]): AsyncGenerator<string> {
  const response: AxiosResponse<IncomingMessage> = await axios.post(
    "https://api.anthropic.com/v1/messages",
    { model: PROVIDER_MODELS.ANTHROPIC, max_tokens: 8096, system, messages, stream: true, temperature: 0.2 },
    { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, responseType: "stream" },
  );
  yield* parseNodeStream(response.data, anthropicExtract);
}

async function generateAnthropic(apiKey: string, system: string, messages: ConversationMessage[]) {
  const { data } = await axios.post<AnthropicResp>(
    "https://api.anthropic.com/v1/messages",
    { model: PROVIDER_MODELS.ANTHROPIC, max_tokens: 8096, system, messages, temperature: 0.2 },
    { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
  );
  return { text: data.content?.map((c) => c.text ?? "").join("") ?? "", promptTokens: data.usage?.input_tokens ?? 0, completionTokens: data.usage?.output_tokens ?? 0 };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function streamWithProvider(params: AiParams): Promise<AsyncGenerator<string>> {
  const system = buildSystem(params);
  const messages = buildMessages(params);
  switch (params.provider) {
    case "GEMINI":    return streamGemini(params.apiKey, system, messages);
    case "OPENAI":    return streamOpenAI("OPENAI", params.apiKey, system, messages);
    case "DEEPSEEK":  return streamOpenAI("DEEPSEEK", params.apiKey, system, messages);
    case "ANTHROPIC": return streamAnthropic(params.apiKey, system, messages);
  }
}

export async function generateWithProvider(params: AiParams): Promise<{
  model: string;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const system = buildSystem(params);
  const messages = buildMessages(params);
  let result: { text: string; promptTokens: number; completionTokens: number };
  switch (params.provider) {
    case "GEMINI":    result = await generateGemini(params.apiKey, system, messages); break;
    case "OPENAI":    result = await generateOpenAI("OPENAI", params.apiKey, system, messages); break;
    case "DEEPSEEK":  result = await generateOpenAI("DEEPSEEK", params.apiKey, system, messages); break;
    case "ANTHROPIC": result = await generateAnthropic(params.apiKey, system, messages); break;
  }
  return {
    model: PROVIDER_MODELS[params.provider],
    content: result.text,
    usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.promptTokens + result.completionTokens },
  };
}
