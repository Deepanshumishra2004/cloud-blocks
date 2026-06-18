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
  baseUrl: z
    .string()
    .trim()
    .url("Base URL must be a valid URL")
    .max(300, "Base URL is too long")
    .optional(),
});

export const ActivateAiCredentialSchema = z.object({
  credentialId: z.string().uuid("Invalid credential id"),
});

// ~7MB of base64 ≈ 5MB raw — generous per-image ceiling for screenshots.
const AgentImageSchema = z.object({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  data: z.string().min(1).max(7_000_000),
});

export const AgentRunSchema = z
  .object({
    task: z.string().trim().max(8000, "Task is too long").default(""),
    mode: z.enum(["auto", "ask"]).default("ask"),
    model: z.string().trim().min(1).max(120).optional(),
    // Continue an existing conversation. Omitted/blank starts a new session.
    sessionId: z.string().uuid().optional(),
    images: z.array(AgentImageSchema).max(6).optional(),
  })
  // A turn must carry a prompt or at least one image.
  .refine((d) => d.task.length > 0 || (d.images?.length ?? 0) > 0, {
    message: "Provide a task or attach an image",
    path: ["task"],
  });

export const AgentRenameSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80, "Title is too long"),
});

export const AgentApproveSchema = z.object({
  runId: z.string().uuid("Invalid run id"),
  toolUseId: z.string().min(1).max(200),
  allow: z.boolean(),
});

export const AgentAbortSchema = z.object({
  runId: z.string().uuid("Invalid run id"),
});

export const AgentAnswerSchema = z.object({
  runId: z.string().uuid("Invalid run id"),
  questionId: z.string().min(1).max(200),
  answers: z.array(z.string().max(2000)).max(10),
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
  model: z
    .string()
    .trim()
    .min(1, "Model is required")
    .max(120, "Model id is too long")
    .optional(),
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
