import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import {
  decryptApiKey,
  encryptApiKey,
  generateWithProvider,
  getDefaultAiModel,
  getRequiredAiCredentialSecret,
  maskApiKey,
  streamWithProvider,
} from "../services/ai.service";
import {
  ActivateAiCredentialSchema,
  AgentAbortSchema,
  AgentAnswerSchema,
  AgentApproveSchema,
  AgentRenameSchema,
  AgentRunSchema,
  CreateAiCredentialSchema,
  GenerateReplCodeSchema,
} from "../types/ai.type";
import {
  abortAgentRun,
  resolveAgentApproval,
  resolveAgentQuestion,
  startAgentRun,
  type AgentEvent,
} from "../services/ai-agent.service";
import type { AgentMessage } from "../services/ai-providers/types";
import { createTurnRecorder } from "../services/agent-session.service";

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
    logger.error({ err: error }, "[listAiCredentials]");
    return res.status(500).json({ message: "Failed to fetch AI credentials" });
  }
};

export const createAiCredential = async (req: Request, res: Response) => {
  try {
    const parsed = CreateAiCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten((i) => i.message).fieldErrors,
      });
    }

    const secret = getRequiredAiCredentialSecret();
    const userId = getUserId(req);
    const { apiKey, name, provider, baseUrl } = parsed.data;

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
        baseUrl: baseUrl ?? null,
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
    logger.error({ err: error }, "[createAiCredential]");
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
        errors: parsed.error.flatten((i) => i.message).fieldErrors,
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
    logger.error({ err: error }, "[activateAiCredential]");
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
    logger.error({ err: error }, "[deleteAiCredential]");
    return res.status(500).json({ message: "Failed to delete AI credential" });
  }
};

export const generateReplCode = async (req: Request, res: Response) => {
  try {
    const parsed = GenerateReplCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten((i) => i.message).fieldErrors,
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
      return res.status(400).json({ message: "Set an active AI credential in API Key Management first" });
    }

    const result = await generateWithProvider({
      provider: activeCredential.provider,
      apiKey: decryptApiKey(activeCredential.encryptedKey, getRequiredAiCredentialSecret()),
      model: parsed.data.model,
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
    }).catch((err: unknown) => logger.error({ err: err }, "[aiUsage]"));

    return res.status(200).json({
      content: result.content,
      model: result.model,
      provider: activeCredential.provider,
      credentialName: activeCredential.name,
    });
  } catch (error) {
    logger.error({ err: error }, "[generateReplCode]");
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to generate code",
    });
  }
};

export const streamReplCode = async (req: Request, res: Response) => {
  try {
    const parsed = GenerateReplCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
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
    if (!activeCredential) return res.status(400).json({ message: "Set an active AI credential in API Key Management first" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const selectedModel = parsed.data.model ?? getDefaultAiModel(activeCredential.provider);
    const stream = await streamWithProvider({
      provider: activeCredential.provider,
      apiKey: decryptApiKey(activeCredential.encryptedKey, getRequiredAiCredentialSecret()),
      model: selectedModel,
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

    res.write(`data: ${JSON.stringify({
      done: true,
      provider: activeCredential.provider,
      credentialName: activeCredential.name,
      model: selectedModel,
    })}\n\n`);
    res.end();
  } catch (error) {
    logger.error({ err: error }, "[streamReplCode]");
    if (!res.headersSent) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Stream failed" });
    }
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream failed" })}\n\n`);
    res.end();
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   AGENT  POST /repl/:replId/ai/agent   (SSE)
   Runs the multi-step tool-using coding agent. Streams step events.
   ────────────────────────────────────────────────────────────────────────── */

export const streamReplAgent = async (req: Request, res: Response) => {
  try {
    const parsed = AgentRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
    }

    const userId = getUserId(req);
    const repl = await prisma.repl.findFirst({
      where: { id: String(req.params.replId), userId },
      select: ownedReplSelect,
    });
    if (!repl) return res.status(404).json({ message: "Repl not found" });

    const activeCredential = await prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
      select: { id: true, provider: true, name: true, encryptedKey: true, baseUrl: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!activeCredential) return res.status(400).json({ message: "Set an active AI credential in API Key Management first" });

    const { task, mode, model, images } = parsed.data;

    // Load or create the conversation session. The session's `context` is the
    // provider-neutral transcript we resume from for continuous chat.
    let session = parsed.data.sessionId
      ? await prisma.agentSession.findFirst({
          where: { id: parsed.data.sessionId, userId, replId: repl.id },
        })
      : null;

    if (!session) {
      session = await prisma.agentSession.create({
        data: {
          replId: repl.id,
          userId,
          title: task.slice(0, 80) || "New session",
          provider: activeCredential.provider,
          model: model ?? null,
          mode,
        },
      });
    }

    const history = Array.isArray(session.context) ? (session.context as unknown as AgentMessage[]) : [];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const write = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    // Accumulate the assistant turn (text + rendered steps) from the event stream
    // so the conversation can be replayed from the DB on reload.
    const recorder = createTurnRecorder();

    const handle = startAgentRun(
      {
        replId: repl.id,
        userId,
        provider: activeCredential.provider,
        apiKey: decryptApiKey(activeCredential.encryptedKey, getRequiredAiCredentialSecret()),
        baseUrlOverride: activeCredential.baseUrl,
        model,
        replType: repl.type,
        task,
        mode,
        history,
        images,
      },
      (event: AgentEvent) => {
        recorder.record(event);
        write(event);
      },
    );

    // Tell the client the runId + sessionId up front so it can approve/abort and
    // associate the run with a persisted session.
    write({ kind: "run", runId: handle.runId, sessionId: session.id });

    // Keepalive: model turns are non-streaming, so a long turn produces no bytes
    // for a minute+. Send an SSE comment every 15s so proxies don't idle-close.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15_000);

    // Abort the run if the client disconnects.
    req.on("close", () => {
      clearInterval(heartbeat);
      handle.abort();
    });

    const result = await handle.done;
    clearInterval(heartbeat);

    const assistantTurn = recorder.finish();
    // Strip image bytes from the persisted transcript: they bloat the row and
    // would be re-sent to the model on every follow-up turn. The image still
    // renders from the user turn's stored data URL.
    const leanContext = result.messages.map((m) =>
      m.role === "user" && "images" in m && m.images?.length
        ? { role: "user" as const, content: m.content }
        : m,
    );
    // Persist the conversation. Only overwrite the session context when the run
    // produced a transcript — on a hard error the agent returns an empty array,
    // and clobbering would wipe the whole prior conversation. Always record the
    // user + assistant turns so the failed turn is still visible in history.
    const ops: Array<ReturnType<typeof prisma.agentSession.update> | ReturnType<typeof prisma.agentTurn.create>> = [];
    if (leanContext.length > 0) {
      ops.push(
        prisma.agentSession.update({
          where: { id: session.id },
          data: { context: leanContext as unknown as object, model: model ?? session.model, mode },
        }),
      );
    } else {
      // Still bump updatedAt + model/mode so the session sorts to the top.
      ops.push(
        prisma.agentSession.update({
          where: { id: session.id },
          data: { model: model ?? session.model, mode },
        }),
      );
    }
    ops.push(
      prisma.agentTurn.create({
        data: {
          sessionId: session.id,
          role: "user",
          text: task,
          images: images?.length ? (images as unknown as object) : undefined,
        },
      }),
      prisma.agentTurn.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          text: assistantTurn.text || (result.reason === "error" ? "(run failed)" : ""),
          steps: assistantTurn.steps.length ? (assistantTurn.steps as unknown as object) : undefined,
        },
      }),
    );
    await prisma.$transaction(ops).catch((err: unknown) => logger.error({ err }, "[agent:persist]"));

    prisma.aiUsage.create({
      data: {
        userId,
        credentialId: activeCredential.id,
        provider: activeCredential.provider,
        promptTokens: 0,
        completionTokens: result.outputTokens,
        totalTokens: result.outputTokens,
      },
    }).catch((err: unknown) => logger.error({ err }, "[aiUsage:agent]"));

    if (!res.writableEnded) res.end();
  } catch (error) {
    logger.error({ err: error }, "[streamReplAgent]");
    if (!res.headersSent) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Agent failed to start" });
    }
    res.write(`data: ${JSON.stringify({ kind: "error", message: error instanceof Error ? error.message : "Agent failed" })}\n\n`);
    res.end();
  }
};

export const approveAgentAction = (req: Request, res: Response) => {
  const parsed = AgentApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
  }
  const ok = resolveAgentApproval(parsed.data.runId, parsed.data.toolUseId, parsed.data.allow);
  if (!ok) return res.status(404).json({ message: "No pending approval for that run/tool" });
  return res.json({ ok: true });
};

export const abortAgent = (req: Request, res: Response) => {
  const parsed = AgentAbortSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
  }
  const ok = abortAgentRun(parsed.data.runId);
  return res.json({ ok });
};

export const answerAgentQuestion = (req: Request, res: Response) => {
  const parsed = AgentAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
  }
  const ok = resolveAgentQuestion(parsed.data.runId, parsed.data.questionId, parsed.data.answers);
  if (!ok) return res.status(404).json({ message: "No pending question for that run" });
  return res.json({ ok: true });
};

/* ──────────────────────────────────────────────────────────────────────────
   AGENT SESSIONS — conversation history (Claude-Code style)
   ────────────────────────────────────────────────────────────────────────── */

const SESSION_LIST_SELECT = {
  id: true,
  title: true,
  model: true,
  mode: true,
  provider: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listAgentSessions = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const replId = String(req.params.replId);
    const repl = await prisma.repl.findFirst({ where: { id: replId, userId }, select: { id: true } });
    if (!repl) return res.status(404).json({ message: "Repl not found" });

    const sessions = await prisma.agentSession.findMany({
      where: { replId, userId },
      select: SESSION_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return res.json({ sessions });
  } catch (error) {
    logger.error({ err: error }, "[listAgentSessions]");
    return res.status(500).json({ message: "Failed to load sessions" });
  }
};

export const getAgentSession = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = await prisma.agentSession.findFirst({
      where: { id: String(req.params.sessionId), userId, replId: String(req.params.replId) },
      select: {
        ...SESSION_LIST_SELECT,
        turns: {
          select: { id: true, role: true, text: true, images: true, steps: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    return res.json({ session });
  } catch (error) {
    logger.error({ err: error }, "[getAgentSession]");
    return res.status(500).json({ message: "Failed to load session" });
  }
};

export const renameAgentSession = async (req: Request, res: Response) => {
  try {
    const parsed = AgentRenameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten((i) => i.message).fieldErrors });
    }
    const userId = getUserId(req);
    const session = await prisma.agentSession.findFirst({
      where: { id: String(req.params.sessionId), userId, replId: String(req.params.replId) },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    await prisma.agentSession.update({ where: { id: session.id }, data: { title: parsed.data.title } });
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "[renameAgentSession]");
    return res.status(500).json({ message: "Failed to rename session" });
  }
};

export const deleteAgentSession = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = await prisma.agentSession.findFirst({
      where: { id: String(req.params.sessionId), userId, replId: String(req.params.replId) },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    await prisma.agentSession.delete({ where: { id: session.id } });
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "[deleteAgentSession]");
    return res.status(500).json({ message: "Failed to delete session" });
  }
};


