// src/controllers/repl.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { z }      from "zod";
import { deleteReplPod, getReplRuntimeUrls, provisionReplRuntime } from "../services/k8s.service";
import { seedReplFromTemplate } from "../services/repl-storage.service";

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

// Ensure the repl belongs to the requesting user before any mutation
async function ownedRepl(replId: string, userId: string) {
  return prisma.repl.findFirst({
    where:  { id: replId, userId },
    select: REPL_SELECT,
  });
}

/* ─────────────────────────────────────────────────────────────
   GET ALL  GET /api/v1/repl/all
───────────────────────────────────────────────────────────── */

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
    console.error("[getAllRepls]", err);
    return res.status(500).json({ message: "Failed to fetch repls" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET ONE  GET /api/v1/repl/:replId
───────────────────────────────────────────────────────────── */

export const getReplById = async (req: Request, res: Response) => {
  try {
    const repl = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!repl) return res.status(404).json({ message: "Repl not found" });

    return res.json({
      repl:
        repl.status === "RUNNING"
          ? { ...repl, ...getReplRuntimeUrls(repl.id) }
          : repl,
    });
  } catch (err) {
    console.error("[getReplById]", err);
    return res.status(500).json({ message: "Failed to fetch repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   CREATE  POST /api/v1/repl/create
───────────────────────────────────────────────────────────── */

export const createRepl = async (req: Request, res: Response) => {
  try {
    const parsed = CreateReplSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten().fieldErrors,
      });
    }

    const userId = (req as any).userId;

    // Enforce per-plan repl limit
    const [count, sub] = await Promise.all([
      prisma.repl.count({ where: { userId } }),
      prisma.subscription.findUnique({
        where:  { userId },
        select: { plan: { select: { maxRepls: true } } },
      }),
    ]);

    const maxRepls = sub?.plan?.maxRepls ?? 3; // 3 = free tier default
    if (count >= maxRepls) {
      return res.status(403).json({
        message: `Your plan allows ${maxRepls} repl${maxRepls !== 1 ? "s" : ""}. Upgrade to create more.`,
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

    await seedReplFromTemplate(repl.id, repl.type).catch((error) => {
      console.error("[createRepl:seedTemplate]", error);
    });

    return res.status(201).json({ repl });
  } catch (err) {
    console.error("[createRepl]", err);
    return res.status(500).json({ message: "Failed to create repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   UPDATE (RENAME)  PATCH /api/v1/repl/:replId
───────────────────────────────────────────────────────────── */

export const updateRepl = async (req: Request, res: Response) => {
  try {
    const parsed = UpdateReplSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten().fieldErrors,
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
    console.error("[updateRepl]", err);
    return res.status(500).json({ message: "Failed to rename repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE  DELETE /api/v1/repl/delete/:replId
───────────────────────────────────────────────────────────── */

export const deleteRepl = async (req: Request, res: Response) => {
  try {
    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    await prisma.repl.delete({ where: { id: (req as any).params.replId } });
    return res.status(200).json({ message: "Repl deleted" });
  } catch (err) {
    console.error("[deleteRepl]", err);
    return res.status(500).json({ message: "Failed to delete repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   START  POST /api/v1/repl/:replId/start
   Marks the repl RUNNING in DB. Wire up your K8s/sandbox
   provisioning here — update status once pod is ready.
───────────────────────────────────────────────────────────── */

export const startRepl = async (req: Request, res: Response) => {
  try {
    const existing = await ownedRepl((req as any).params.replId, (req as any).userId);
    if (!existing) return res.status(404).json({ message: "Repl not found" });

    if (existing.status === "RUNNING") {
      return res.status(409).json({ message: "Repl is already running" });
    }

    let runtime;
    try {
      runtime = await provisionReplRuntime(existing.id, existing.type);
    } catch (provisionErr) {
      console.error("[startRepl:provision]", provisionErr);

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

    const repl = await prisma.repl.update({
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
    console.error("[startRepl]", err);
    return res.status(500).json({ message: "Failed to start repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   STOP  POST /api/v1/repl/:replId/stop
───────────────────────────────────────────────────────────── */

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
    console.error("[stopRepl]", err);
    return res.status(500).json({ message: "Failed to stop repl" });
  }
};

/* ─────────────────────────────────────────────────────────────
   HELPER — relative time string for lastActive
───────────────────────────────────────────────────────────── */

function formatRelative(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)          return "just now";
  if (s < 3600)        return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)       return `${Math.floor(s / 3600)}h ago`;
  return               `${Math.floor(s / 86400)}d ago`;
}
