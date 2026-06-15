// Single source of truth for AI provider metadata.
//
// Adding a new OpenAI-compatible provider is a one-row change here — no new
// adapter code. Only a genuinely non-standard wire format needs a new family.
//
// This list also feeds:
//   - the Zod credential schema (backend/types/ai.type.ts)
//   - the Prisma `AiProvider` enum (keep prisma/schema.prisma in sync by hand)
//   - the single-shot generation service (backend/services/ai.service.ts)

export const AI_PROVIDERS = [
  "OPENROUTER",
  "GEMINI",
  "OPENAI",
  "ANTHROPIC",
  "DEEPSEEK",
  "QWEN",
  "ZHIPU",
  "KIMI",
  "MINIMAX",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

// Wire-format families. Each maps to exactly one adapter implementation.
export type ProviderFamily = "anthropic" | "openai" | "gemini";

export interface ProviderConfig {
  /** Human label for the UI. */
  label: string;
  /** Which adapter translates this provider's tool-use wire format. */
  family: ProviderFamily;
  /** Default API base URL. Overridable per-credential via AiCredential.baseUrl. */
  baseUrl: string;
  /** Default model when the credential / request doesn't specify one. */
  defaultModel: string;
  /** Whether the default model is reliable at multi-step tool use (agent mode). */
  agentCapable: boolean;
}

export const PROVIDER_REGISTRY: Record<AiProvider, ProviderConfig> = {
  ANTHROPIC: {
    label: "Anthropic",
    family: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-opus-4-8",
    agentCapable: true,
  },
  OPENAI: {
    label: "OpenAI",
    family: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    agentCapable: true,
  },
  OPENROUTER: {
    label: "OpenRouter",
    family: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-opus-4-8",
    agentCapable: true,
  },
  DEEPSEEK: {
    label: "DeepSeek",
    family: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    agentCapable: true,
  },
  QWEN: {
    label: "Qwen (Alibaba)",
    family: "openai",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-max",
    agentCapable: true,
  },
  ZHIPU: {
    label: "Zhipu GLM",
    family: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6",
    agentCapable: true,
  },
  KIMI: {
    label: "Moonshot Kimi",
    family: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2-0905-preview",
    agentCapable: true,
  },
  MINIMAX: {
    label: "MiniMax",
    family: "openai",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M2",
    agentCapable: true,
  },
  GEMINI: {
    label: "Google Gemini",
    family: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    agentCapable: true,
  },
};

export function getProviderConfig(provider: AiProvider): ProviderConfig {
  const config = PROVIDER_REGISTRY[provider];
  if (!config) throw new Error(`Unknown AI provider: ${provider}`);
  return config;
}

export function getDefaultAiModel(provider: AiProvider): string {
  return getProviderConfig(provider).defaultModel;
}

/** Effective base URL: per-credential override wins over the registry default. */
export function resolveBaseUrl(provider: AiProvider, override?: string | null): string {
  const trimmed = override?.trim();
  return trimmed || getProviderConfig(provider).baseUrl;
}

/** Effective model: explicit request/credential model wins over the registry default. */
export function resolveModel(provider: AiProvider, model?: string | null): string {
  const trimmed = model?.trim();
  return trimmed || getDefaultAiModel(provider);
}
