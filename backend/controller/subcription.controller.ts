// src/controllers/subscription.controller.ts
import type { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/* ─────────────────────────────────────────────────────────────
   GET USER SUBSCRIPTION  GET /api/v1/subscription/:id
   Note: frontend uses GET /api/v1/plan/subscription instead.
   This route exists for admin/internal lookups by subscription id.
───────────────────────────────────────────────────────────── */

export const getUserSubscription = async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where:  { id: (req as any).params.id },
      include: { plan: true },
    });

    // Security: only the subscription owner can view it
    if (!sub || sub.userId !== (req as any).userId) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.json({ subscription: sub });
  } catch (err) {
    console.error("[getUserSubscription]", err);
    return res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

/* ─────────────────────────────────────────────────────────────
   CANCEL SUBSCRIPTION  DELETE /api/v1/subscription/delete
   Cancels at period end (not immediately) so the user keeps
   access until their paid period expires.
───────────────────────────────────────────────────────────── */

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const sub = await prisma.subscription.findUnique({
      where:  { userId },
      select: { id: true, userId: true, stripeSubscriptionId: true, status: true },
    });

    if (!sub || sub.userId !== userId) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (sub.status === "CANCELED") {
      return res.status(409).json({ message: "Subscription is already canceled" });
    }

    // cancel_at_period_end: true — user keeps access until period ends
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Mark CANCELED locally — the webhook will confirm on actual expiry
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data:  { status: "CANCELED" },
    });

    return res.json({
      message:      "Subscription will cancel at the end of the billing period",
      subscription: updated,
    });
  } catch (err) {
    console.error("[cancelSubscription]", err);
    return res.status(500).json({ message: "Failed to cancel subscription" });
  }
};