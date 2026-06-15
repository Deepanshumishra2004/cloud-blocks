// src/controllers/plan.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { getOrCreateActiveSubscription, getUserReplUsage } from "../services/plan-limits.service";
import { getUserStorageUsageMB } from "../services/repl-storage.service";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET ALL PLANS  GET /api/v1/plan/all
   Public â€” shows available plans for landing/pricing page
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getAllPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: "asc" },
    });
    return res.json({ plans });
  } catch (err) {
    logger.error({ err: err }, "[getAllPlans]");
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET SINGLE PLAN  GET /api/v1/plan/:planId
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getSinglePlan = async (req: Request, res: Response) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: (req as any).params.planId },
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    return res.json({ plan });
  } catch (err) {
    logger.error({ err: err }, "[getSinglePlan]");
    return res.status(500).json({ message: "Failed to fetch plan" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CREATE PLAN  POST /api/v1/plan/create
   Admin-only â€” use middleware to guard in production
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const createPlan = async (req: Request, res: Response) => {
  try {
    const { name, price, stripePriceId, billingCycle, maxRepls, maxStorageMB } = req.body;

    if (!name || price == null || !stripePriceId || !billingCycle || maxRepls == null || maxStorageMB == null) {
      return res.status(400).json({ message: "All plan fields are required" });
    }

    const plan = await prisma.plan.create({
      data: { name, price, stripePriceId, billingCycle, maxRepls, maxStorageMB },
    });

    return res.status(201).json({ plan });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "A plan with that name or Stripe price ID already exists" });
    }
    logger.error({ err: err }, "[createPlan]");
    return res.status(500).json({ message: "Failed to create plan" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   DELETE PLAN  POST /api/v1/plan/delete
   Admin-only â€” will fail if subscriptions reference this plan
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.body as { planId?: string };
    if (!planId) return res.status(400).json({ message: "planId is required" });

    await prisma.plan.delete({ where: { id: planId } });
    return res.status(200).json({ message: "Plan deleted" });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ message: "Plan not found" });
    // P2003 = FK constraint â€” active subscriptions exist
    if (err.code === "P2003") {
      return res.status(409).json({ message: "Cannot delete plan with active subscriptions" });
    }
    logger.error({ err: err }, "[deletePlan]");
    return res.status(500).json({ message: "Failed to delete plan" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET USER SUBSCRIPTION  GET /api/v1/plan/subscription
   Called by: billing page
   Returns current subscription + plan details.
   Falls back to a virtual "STARTER" object if no DB row exists
   (free users never get a Subscription row).
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getUserSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const sub = await getOrCreateActiveSubscription(userId);

    if (!sub) return res.status(503).json({ message: "Free plan is not configured" });

    return res.json({ subscription: sub });
  } catch (err) {
    logger.error({ err: err }, "[getUserSubscription]");
    return res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GET USER USAGE  GET /api/v1/plan/usage
   Called by: billing page usage meters
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const getUserUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const { replCount, subscription, maxRepls, maxStorageMB } = await getUserReplUsage(userId);

    // Real storage usage = sum of object sizes under the user's R2 workspace prefix.
    // Compute hours remain a placeholder until the sandbox layer tracks runtime.
    const usedMb = await getUserStorageUsageMB(userId).catch((err) => {
      logger.error({ err }, "[getUserUsage] storage usage lookup failed");
      return 0;
    });

    return res.json({
      usage: {
        repls:   { used: replCount,  max: maxRepls       },
        storage: { usedMb,           maxMb: maxStorageMB  },
        compute: { usedHrs: 0,       maxHrs: subscription ? 100 : 10 },
      },
    });
  } catch (err) {
    logger.error({ err: err }, "[getUserUsage]");
    return res.status(500).json({ message: "Failed to fetch usage" });
  }
};

