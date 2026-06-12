// src/controllers/repl.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { z }      from "zod";
import { deleteReplPod, getReplPodState, getReplRuntimeUrls, provisionReplRuntime, replPodExists } from "../services/k8s.service";
import { seedReplFromTemplate } from "../services/repl-storage.service";
import { logger } from "../lib/logger";
import { canCreateRepl, formatReplLimit, getUserReplUsage } from "../services/plan-limits.service";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   VALIDATION
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const REPL_TYPES = ["BUN", "JAVASCRIPT", "NODE", "REACT", "NEXT"] as const;

const CreateReplSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(40, "Name too long")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens"),
  type: z.enum(REPL_TYPES)
});

const UpdateReplSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(40, "Name too long")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens"),
});

// Fields returned on every repl response
const REPL_SELECT = {
  id:        true,
  name:      true,
  type:      true,
  status:    true,
  userId:    true,
  createdAt: true,
  updatedAt: true,
} as const;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   HELPERS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// Ensure the repl belongs to the requesting user before any mutation
async function ownedRepl(replId: string, userId: string) {
  return prisma.repl.findFirst({
    where:  { id: replId, userId },
    select: REPL_SELECT,
  });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET ALL  GET /api/v1/repl/all
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getAllRepls = async (req: Request, res: Response) => {
  try {
    const repls = await prisma.repl.findMany({
      where:   { userId: (req as any).userId },
      select:  REPL_SELECT,
      orderBy: { updatedAt: "desc" },
    });

    // Attach a human-readable lastActive string for the frontend
    const now = Date.now();
    const withLastActive = repls.map((r) => ({
      ...r,
      lastActive: formatRelative(now - r.updatedAt.getTime()),
    }));

    return res.json({ repls: withLastActive });
  } catch (err) {
    logger.error({ err: err }, "[getAllRepls]");
    return res.status(500).json({ message: "Failed to fetch repls" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET ONE  GET /api/v1/repl/:replId
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getReplById = async (req: Request, res: Response) => {
  try {
    const repl = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!repl) return res.status(404).json({ message: "Repl not found" });

    if (repl.status === "RUNNING") {
      const podAlive = await replPodExists(repl.id);
      if (!podAlive) {
        await prisma.repl.update({ where: { id: repl.id }, data: { status: "STOPPED" } });
        return res.json({ repl: { ...repl, status: "STOPPED" } });
      }
      return res.json({ repl: { ...repl, ...getReplRuntimeUrls(repl.id) } });
    }

    return res.json({ repl });
  } catch (err) {
    logger.error({ err: err }, "[getReplById]");
    return res.status(500).json({ message: "Failed to fetch repl" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CREATE  POST /api/v1/repl/create
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const createRepl = async (req: Request, res: Response) => {
  try {
    const parsed = CreateReplSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten((i) => i.message).fieldErrors,
      });
    }

    const userId = (req as any).userId;

    const { replCount, maxRepls } = await getUserReplUsage(userId);
    if (!canCreateRepl(replCount, maxRepls)) {
      return res.status(403).json({
        message: `Your plan allows ${formatReplLimit(maxRepls)}. You are using ${replCount}/${maxRepls}. Upgrade to create more.`,
      });
    }

    const repl = await prisma.repl.create({
      data: {
        name:   parsed.data.name,
        type:   parsed.data.type,
        userId,
        status: "STOPPED",
      },
      select: REPL_SELECT,
    });

    await seedReplFromTemplate(repl.id, repl.type, userId).catch((error) => {
      logger.error({ err: error }, "[createRepl:seedTemplate]");
    });

    return res.status(201).json({ repl });
  } catch (err) {
    logger.error({ err: err }, "[createRepl]");
    return res.status(500).json({ message: "Failed to create repl" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   UPDATE (RENAME)  PATCH /api/v1/repl/:replId
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const updateRepl = async (req: Request, res: Response) => {
  try {
    const parsed = UpdateReplSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten((i) => i.message).fieldErrors,
      });
    }

    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    const repl = await prisma.repl.update({
      where:  { id: (req as any).params.replId },
      data:   { name: parsed.data.name },
      select: REPL_SELECT,
    });

    return res.json({ repl });
  } catch (err) {
    logger.error({ err: err }, "[updateRepl]");
    return res.status(500).json({ message: "Failed to rename repl" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   DELETE  DELETE /api/v1/repl/delete/:replId
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const deleteRepl = async (req: Request, res: Response) => {
  try {
    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    if (existing.status === "RUNNING") {
      await deleteReplPod(existing.id).catch((err) =>
        logger.error({ err, replId: existing.id }, "deleteRepl: failed to remove K8s resources")
      );
    }

    await prisma.repl.delete({ where: { id: (req as any).params.replId } });
    return res.status(200).json({ message: "Repl deleted" });
  } catch (err) {
    logger.error({ err: err }, "[deleteRepl]");
    return res.status(500).json({ message: "Failed to delete repl" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   START  POST /api/v1/repl/:replId/start
   Marks the repl RUNNING in DB. Wire up your K8s/sandbox
   provisioning here â€” update status once pod is ready.
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const startRepl = async (req: Request, res: Response) => {
  try {
    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    const podState = await getReplPodState(existing.id);
    if (podState.ready) {
      await prisma.repl.update({
        where: { id: existing.id },
        data: { status: "RUNNING" },
      });

      return res.status(200).json({
        message: "Repl already running",
        status: "RUNNING",
        ...getReplRuntimeUrls(existing.id),
      });
    }

    let runtime;
    try {
      runtime = await provisionReplRuntime(existing.id, existing.type, (req as any).userId);
    } catch (provisionErr) {
      logger.error({ err: provisionErr }, "[startRepl:provision]");

      const e = provisionErr as {
        statusCode?: number;
        body?: { reason?: string; message?: string };
        message?: string;
      };

      const detail = e?.body?.message || e?.message || "Unknown Kubernetes error";

      return res.status(502).json({
        message: `Failed to provision repl sandbox: ${detail}`,
      });
    }    

    await prisma.repl.update({
      where:  { id: existing.id },
      data:   { status: "RUNNING" },
      select: REPL_SELECT,
    });

    return res.status(200).json({
      message: "Repl started successfully",
      replId: existing.id,
      status: "RUNNING",
      previewUrl: runtime.previewUrl,
      wsUrl: runtime.wsUrl,
      host: runtime.host,
    });
  } catch (err) {
    logger.error({ err: err }, "[startRepl]");
    return res.status(500).json({ message: "Failed to start repl" , error : `err` });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   STOP  POST /api/v1/repl/:replId/stop
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const stopRepl = async (req: Request, res: Response) => {
  try {
    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    if (existing.status === "STOPPED") {
      return res.status(409).json({ message: "Repl is already stopped" });
    }

    await deleteReplPod(existing.id);

    const repl = await prisma.repl.update({
      where:  { id: existing.id },
      data:   { status: "STOPPED" },
      select: REPL_SELECT,
    });

    return res.json({ repl });
  } catch (err) {
    logger.error({ err: err }, "[stopRepl]");
    return res.status(500).json({ message: "Failed to stop repl" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   HELPER â€” relative time string for lastActive
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function formatRelative(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)          return "just now";
  if (s < 3600)        return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)       return `${Math.floor(s / 3600)}h ago`;
  return               `${Math.floor(s / 86400)}d ago`;
}


