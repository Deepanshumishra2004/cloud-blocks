import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/authMiddleware";
import { stripe } from "../lib/stripe";

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const sub = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (sub.status === "CANCELED") {
      return res.status(400).json({ message: "Subscription already canceled" });
    }

    // cancel in Stripe — webhook's customer.subscription.deleted will update DB
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

    return res.json({ message: "Subscription canceled" });
  } catch (err) {
    console.error("[cancelSubscription]", err);
    return res.status(500).json({ message: "Cancel failed" });
  }
};

export const getUserSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({ message: "No subscription found" });
    }

    return res.json(subscription);
  } catch (err) {
    console.error("[getUserSubscription]", err);
    return res.status(500).json({ message: "Fetch failed" });
  }
};