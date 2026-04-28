// src/services/payment.service.ts

import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

type BillingCycleType = "MONTHLY" | "YEAR";

export const createCheckoutSession = async (
    userId: string,
    planId: string
  ) => {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });
  
    if (!plan) throw new Error("Plan not found");

    const clientUrl = env.CLIENT_URL ?? env.FRONTEND_URL;
  
    return stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/success`,
      cancel_url: `${clientUrl}/cancel`,
      metadata: {
        userId,
        planId,
      },
    });
  };

export const recordSuccessfulPayment = async (
  userId: string,
  subscriptionId: string,
  amount: number,
  currency: string,
  stripeSessionId: string
) => {
  return prisma.payment.create({
    data: {
      userId,
      subscriptionId,
      amount,
      currency,
      status: "SUCCESS",
      provider: "stripe",
      providerId: stripeSessionId,
    },
  });
};