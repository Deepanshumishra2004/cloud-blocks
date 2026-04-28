import { describe, expect, it } from "bun:test";
import {
  decryptApiKey,
  encryptApiKey,
  extractGeminiText,
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

  it("masks API keys without exposing the middle of the value", () => {
    expect(maskApiKey("AIzaSyD7-example-secret-value")).toBe("AIza...alue");
    expect(maskApiKey("abcd")).toBe("****");
  });

  it("extracts plain text from a Gemini response payload", () => {
    const text = extractGeminiText({
      candidates: [
        {
          content: {
            parts: [{ text: "export default function App() { return null; }\n" }],
          },
        },
      ],
    });

    expect(text).toContain("export default function App");
  });
});
