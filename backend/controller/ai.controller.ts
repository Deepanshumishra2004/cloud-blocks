import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  decryptApiKey,
  encryptApiKey,
  generateWithProvider,
  getRequiredAiCredentialSecret,
  maskApiKey,
  streamWithProvider,
} from "../services/ai.service";
import {
  ActivateAiCredentialSchema,
  CreateAiCredentialSchema,
  GenerateReplCodeSchema,
} from "../types/ai.type";

const AI_CREDENTIAL_SELECT = {
  id: true,
  provider: true,
  name: true,
  last4: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ownedReplSelect = {
  id: true,
  type: true,
  userId: true,
} as const;

function getUserId(req: Request): string {
  return (req as any).userId;
}

export const listAiCredentials = async (req: Request, res: Response) => {
  try {
    const credentials = await prisma.aiCredential.findMany({
      where: { userId: getUserId(req) },
      select: AI_CREDENTIAL_SELECT,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return res.json({
      credentials: credentials.map((credential: (typeof credentials)[number]) => ({
        ...credential,
        maskedKey: `****${credential.last4}`,
      })),
    });
  } catch (error) {
    console.error("[listAiCredentials]", error);
    return res.status(500).json({ message: "Failed to fetch AI credentials" });
  }
};

export const createAiCredential = async (req: Request, res: Response) => {
  try {
    const parsed = CreateAiCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const secret = getRequiredAiCredentialSecret();
    const userId = getUserId(req);
    const { apiKey, name, provider } = parsed.data;

    const existing = await prisma.aiCredential.findFirst({
      where: {
        userId,
        provider,
        name,
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ message: "A credential with that name already exists for this provider" });
    }

    const credential = await prisma.aiCredential.create({
      data: {
        userId,
        provider,
        name,
        encryptedKey: encryptApiKey(apiKey, secret),
        last4: apiKey.slice(-4),
      },
      select: AI_CREDENTIAL_SELECT,
    });

    return res.status(201).json({
      credential: {
        ...credential,
        maskedKey: maskApiKey(apiKey),
      },
    });
  } catch (error) {
    console.error("[createAiCredential]", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to save AI credential",
    });
  }
};

export const activateAiCredential = async (req: Request, res: Response) => {
  try {
    const parsed = ActivateAiCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = getUserId(req);
    const credential = await prisma.aiCredential.findFirst({
      where: { id: parsed.data.credentialId, userId },
      select: { id: true },
    });

    if (!credential) {
      return res.status(404).json({ message: "AI credential not found" });
    }

    await prisma.$transaction([
      prisma.aiCredential.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      prisma.aiCredential.update({
        where: { id: credential.id },
        data: { isActive: true },
      }),
    ]);

    return res.status(200).json({ message: "Active AI credential updated" });
  } catch (error) {
    console.error("[activateAiCredential]", error);
    return res.status(500).json({ message: "Failed to update active AI credential" });
  }
};

export const deleteAiCredential = async (req: Request, res: Response) => {
  try {
    const credential = await prisma.aiCredential.findFirst({
      where: {
        id: String(req.params.credentialId),
        userId: getUserId(req),
      },
      select: { id: true },
    });

    if (!credential) {
      return res.status(404).json({ message: "AI credential not found" });
    }

    await prisma.aiCredential.delete({
      where: { id: credential.id },
    });

    return res.status(200).json({ message: "AI credential deleted" });
  } catch (error) {
    console.error("[deleteAiCredential]", error);
    return res.status(500).json({ message: "Failed to delete AI credential" });
  }
};

export const generateReplCode = async (req: Request, res: Response) => {
  try {
    const parsed = GenerateReplCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = getUserId(req);
    const repl = await prisma.repl.findFirst({
      where: { id: String(req.params.replId), userId },
      select: ownedReplSelect,
    });

    if (!repl) {
      return res.status(404).json({ message: "Repl not found" });
    }

    const activeCredential = await prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        name: true,
        encryptedKey: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeCredential) {
      return res.status(400).json({ message: "Set an active AI credential in Settings first" });
    }

    const result = await generateWithProvider({
      provider: activeCredential.provider,
      apiKey: decryptApiKey(activeCredential.encryptedKey, getRequiredAiCredentialSecret()),
      prompt: parsed.data.prompt,
      filePath: parsed.data.filePath,
      currentContent: parsed.data.currentContent,
      replType: repl.type,
      fileTree: parsed.data.fileTree,
      relatedFiles: parsed.data.relatedFiles,
      history: parsed.data.history,
    });

    prisma.aiUsage.create({
      data: {
        userId,
        credentialId:     activeCredential.id,
        provider:         activeCredential.provider,
        promptTokens:     result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens:      result.usage.totalTokens,
      },
    }).catch((err: unknown) => console.error("[aiUsage]", err));

    return res.status(200).json({
      content: result.content,
      model: result.model,
      provider: activeCredential.provider,
      credentialName: activeCredential.name,
    });
  } catch (error) {
    console.error("[generateReplCode]", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to generate code",
    });
  }
};

export const streamReplCode = async (req: Request, res: Response) => {
  try {
    const parsed = GenerateReplCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
    }

    const userId = getUserId(req);
    const repl = await prisma.repl.findFirst({
      where: { id: String(req.params.replId), userId },
      select: ownedReplSelect,
    });
    if (!repl) return res.status(404).json({ message: "Repl not found" });

    const activeCredential = await prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
      select: { id: true, provider: true, name: true, encryptedKey: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!activeCredential) return res.status(400).json({ message: "Set an active AI credential in Settings first" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await streamWithProvider({
      provider: activeCredential.provider,
      apiKey: decryptApiKey(activeCredential.encryptedKey, getRequiredAiCredentialSecret()),
      prompt: parsed.data.prompt,
      filePath: parsed.data.filePath,
      currentContent: parsed.data.currentContent,
      replType: repl.type,
      fileTree: parsed.data.fileTree,
      relatedFiles: parsed.data.relatedFiles,
      history: parsed.data.history,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, provider: activeCredential.provider, credentialName: activeCredential.name })}\n\n`);
    res.end();
  } catch (error) {
    console.error("[streamReplCode]", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Stream failed" });
    }
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream failed" })}\n\n`);
    res.end();
  }
};
