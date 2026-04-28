import crypto from "crypto";
import { env } from "../config/env";

export const AI_PROVIDERS = ["GEMINI", "OPENAI", "ANTHROPIC", "DEEPSEEK"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

const GEMINI_MODEL = "gemini-2.5-flash";

function getEncryptionKey(secret: string): Buffer {
  if (secret.length !== 32) {
    throw new Error("AI_CREDENTIAL_SECRET must be exactly 32 characters long");
  }

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

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Stored API key is malformed");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(secret),
    Buffer.from(ivPart, "base64"),
  );

  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "*".repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function extractGeminiText(payload: GeminiResponse): string {
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(payload.error?.message || "Gemini returned an empty response");
  }

  return text.replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "").trim();
}

export function getRequiredAiCredentialSecret(): string {
  if (!env.AI_CREDENTIAL_SECRET) {
    throw new Error("AI credentials are not configured on the server");
  }
  return env.AI_CREDENTIAL_SECRET;
}

export async function generateWithProvider(params: {
  provider: AiProvider;
  apiKey: string;
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
  fileTree?: string;
  relatedFiles?: Array<{ path: string; content: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  switch (params.provider) {
    case "GEMINI":
      return generateWithGemini(params);
    case "OPENAI":
    case "ANTHROPIC":
    case "DEEPSEEK":
      throw new Error(`${params.provider} is not enabled yet`);
    default:
      throw new Error("Unsupported AI provider");
  }
}

export async function streamWithProvider(params: {
  provider: AiProvider;
  apiKey: string;
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
  fileTree?: string;
  relatedFiles?: Array<{ path: string; content: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AsyncGenerator<string>> {
  switch (params.provider) {
    case "GEMINI":
      return streamWithGemini(params);
    case "OPENAI":
    case "ANTHROPIC":
    case "DEEPSEEK":
      throw new Error(`${params.provider} streaming is not enabled yet`);
    default:
      throw new Error("Unsupported AI provider");
  }
}

async function* streamWithGemini(params: {
  apiKey: string;
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
}): AsyncGenerator<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": params.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(params) }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );

  if (!response.ok || !response.body) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || "Gemini stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;
      try {
        const chunk = JSON.parse(json) as GeminiResponse;
        const text = chunk.candidates
          ?.flatMap((c) => c.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("") ?? "";
        if (text) yield text;
      } catch {
        // skip malformed chunk
      }
    }
  }
}

function buildPrompt(params: {
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
  fileTree?: string;
  relatedFiles?: Array<{ path: string; content: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  const numberedContent = params.currentContent
    .split("\n")
    .map((l, i) => `${i + 1}| ${l}`)
    .join("\n");

  const lines = [
    `You are an expert coding assistant inside a cloud REPL (type: ${params.replType}).`,
    "",
    "Always respond with a single JSON object — no markdown, no text outside the JSON.",
    "Schema:",
    '{ "type": "chat"|"code"|"mixed", "message": string|null, "edits": Edit[]|null }',
    "where Edit = { startLine: number, endLine: number, newContent: string }",
    "",
    "Rules for choosing type:",
    '- "chat"  → user asked a question, wants explanation, no code changes needed.',
    '- "code"  → user asked to add/fix/refactor code. message is optional brief summary.',
    '- "mixed" → code change needed AND explanation is helpful.',
    "",
    "Rules for edits:",
    "- Lines are 1-indexed, startLine/endLine inclusive.",
    "- Only include lines that actually change.",
    "- newContent is the replacement text (empty string to delete those lines).",
    "- Preserve the file's code style.",
    "",
  ];

  if (params.fileTree) {
    lines.push("Project file tree:", params.fileTree, "");
  }

  if (params.relatedFiles?.length) {
    lines.push("Related files for context (do not rewrite these):");
    for (const f of params.relatedFiles) {
      lines.push(`\n--- ${f.path} ---\n${f.content}`);
    }
    lines.push("");
  }

  lines.push(`Target file: ${params.filePath}`, "", "Current file contents (line-numbered):", numberedContent, "");

  if (params.history?.length) {
    lines.push("Conversation so far:");
    for (const m of params.history) {
      lines.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
    }
    lines.push("");
  }

  lines.push("User:", params.prompt);

  return lines.join("\n");
}

async function generateWithGemini(params: {
  apiKey: string;
  prompt: string;
  filePath: string;
  currentContent: string;
  replType: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(params) }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );

  const payload = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed");
  }

  return {
    model: GEMINI_MODEL,
    content: extractGeminiText(payload),
    usage: {
      promptTokens:     payload.usageMetadata?.promptTokenCount     ?? 0,
      completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens:      payload.usageMetadata?.totalTokenCount      ?? 0,
    },
  };
}
