import { z } from "zod";
import { AI_PROVIDERS } from "../services/ai.service";

export const CreateAiCredentialSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  name: z
    .string()
    .trim()
    .min(1, "Credential name is required")
    .max(40, "Credential name is too long"),
  apiKey: z
    .string()
    .trim()
    .min(8, "API key looks too short")
    .max(512, "API key is too long"),
});

export const ActivateAiCredentialSchema = z.object({
  credentialId: z.string().uuid("Invalid credential id"),
});

export const GenerateReplCodeSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(4, "Prompt is too short")
    .max(4000, "Prompt is too long"),
  filePath: z
    .string()
    .trim()
    .min(1, "File path is required")
    .max(400, "File path is too long"),
  currentContent: z
    .string()
    .max(200_000, "File content is too large for a single generation request"),
  fileTree: z.string().max(10_000).optional(),
  relatedFiles: z
    .array(z.object({ path: z.string(), content: z.string().max(50_000) }))
    .max(5)
    .optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional(),
});
