// src/controllers/plan.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/* ─────────────────────────────────────────────────────────────
   GET ALL PLANS  GET /api/v1/plan/all
   Public — shows available plans for landing/pricing page
───────────────────────────────────────────────────────────── */

export const getAllPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: "asc" },
    });
    return res.json({ plans });
  } catch (err) {
    console.error("[getAllPlans]", err);
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET SINGLE PLAN  GET /api/v1/plan/:planId
───────────────────────────────────────────────────────────── */

export const getSinglePlan = async (req: Request, res: Response) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: (req as any).params.planId },
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    return res.json({ plan });
  } catch (err) {
    console.error("[getSinglePlan]", err);
    return res.status(500).json({ message: "Failed to fetch plan" });
  }
};

/* ─────────────────────────────────────────────────────────────
   CREATE PLAN  POST /api/v1/plan/create
   Admin-only — use middleware to guard in production
───────────────────────────────────────────────────────────── */

export const createPlan = async (req: Request, res: Response) => {
  try {
    const { name, price, stripePriceId, billingCycle, maxRepls, maxStorageMB } = req.body;

    console.log(req.body);

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
    console.error("[createPlan]", err);
    return res.status(500).json({ message: "Failed to create plan" });
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE PLAN  POST /api/v1/plan/delete
   Admin-only — will fail if subscriptions reference this plan
───────────────────────────────────────────────────────────── */

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.body as { planId?: string };
    if (!planId) return res.status(400).json({ message: "planId is required" });

    await prisma.plan.delete({ where: { id: planId } });
    return res.status(200).json({ message: "Plan deleted" });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ message: "Plan not found" });
    // P2003 = FK constraint — active subscriptions exist
    if (err.code === "P2003") {
      return res.status(409).json({ message: "Cannot delete plan with active subscriptions" });
    }
    console.error("[deletePlan]", err);
    return res.status(500).json({ message: "Failed to delete plan" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET USER SUBSCRIPTION  GET /api/v1/plan/subscription
   Called by: billing page
   Returns current subscription + plan details.
   Falls back to a virtual "STARTER" object if no DB row exists
   (free users never get a Subscription row).
───────────────────────────────────────────────────────────── */

export const getUserSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    let sub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub) {
      const freePlan = await prisma.plan.findFirst({
        where: { name: "FREE" },
        orderBy: { billingCycle: "asc" },
      });

      if (freePlan) {
        sub = await prisma.subscription.upsert({
          where: { userId },
          update: {},
          create: {
            userId,
            planId: freePlan.id,
            stripeSubscriptionId: `free_${userId}`,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
          },
          include: { plan: true },
        });
      }
    }

    if (!sub) return res.status(503).json({ message: "Free plan is not configured" });

    return res.json({ subscription: sub });
  } catch (err) {
    console.error("[getUserSubscription]", err);
    return res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET USER USAGE  GET /api/v1/plan/usage
   Called by: billing page usage meters
───────────────────────────────────────────────────────────── */

export const getUserUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const [replCount, sub] = await Promise.all([
      prisma.repl.count({ where: { userId } }),
      prisma.subscription.findUnique({
        where:  { userId },
        select: {
          plan: {
            select: { maxRepls: true, maxStorageMB: true },
          },
        },
      }),
    ]);

    const maxRepls     = sub?.plan?.maxRepls     ?? 3;    // free tier defaults
    const maxStorageMB = sub?.plan?.maxStorageMB ?? 500;

    // Storage and compute are placeholders — wire up real metrics
    // once your sandbox layer tracks them (e.g. via K8s resource usage API)
    return res.json({
      usage: {
        repls:   { used: replCount,  max: maxRepls     },
        storage: { usedMb: 0,        maxMb: maxStorageMB },
        compute: { usedHrs: 0,       maxHrs: sub ? 100 : 10 },
      },
    });
  } catch (err) {
    console.error("[getUserUsage]", err);
    return res.status(500).json({ message: "Failed to fetch usage" });
  }
};
