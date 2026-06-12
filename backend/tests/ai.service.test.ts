import { describe, expect, it } from "bun:test";
import {
  getDefaultAiModel,
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
} from "../services/ai.service";

describe("ai.service", () => {
  it("encrypts and decrypts API keys with a stable secret", () => {
    const secret = "12345678901234567890123456789012";
    const apiKey = "AIzaSyD7-example-secret-value";

    const encrypted = encryptApiKey(apiKey, secret);

    expect(encrypted).not.toBe(apiKey);
    expect(decryptApiKey(encrypted, secret)).toBe(apiKey);
  });

  it("supports long credential secrets without requiring exactly 32 characters", () => {
    const secret = "this-is-a-long-production-secret-that-is-more-than-32-characters";
    const apiKey = "sk-or-v1-example-secret-value";

    const encrypted = encryptApiKey(apiKey, secret);

    expect(decryptApiKey(encrypted, secret)).toBe(apiKey);
  });

  it("masks API keys without exposing the middle of the value", () => {
    expect(maskApiKey("AIzaSyD7-example-secret-value")).toBe("AIza...alue");
    expect(maskApiKey("abcd")).toBe("****");
  });

  it("uses OpenRouter as a first-class provider with a switchable model", () => {
    expect(getDefaultAiModel("OPENROUTER")).toBe("openai/gpt-5.2");
  });
});
