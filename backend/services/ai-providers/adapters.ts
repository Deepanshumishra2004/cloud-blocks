import type { ProviderAdapter } from "./types";
import type { ProviderFamily } from "./registry";
import { anthropicAdapter } from "./anthropic-agent";
import { openaiAdapter } from "./openai-agent";
import { geminiAdapter } from "./gemini-agent";

const ADAPTERS: Record<ProviderFamily, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
};

export function getAdapter(family: ProviderFamily): ProviderAdapter {
  return ADAPTERS[family];
}
