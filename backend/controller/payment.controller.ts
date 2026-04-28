// src/controllers/payment.controller.ts
import type { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { BillingCycle, PlanName } from "../generated/prisma/enums";
import z from "zod";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
});

type SubscriptionWithPeriod = Stripe.Subscription;

/* ─────────────────────────────────────────────────────────────
   CREATE CHECKOUT SESSION  POST /api/v1/payment/checkout
───────────────────────────────────────────────────────────── */

const PlanSChema = z.object({
  PlanNames: z.enum(PlanName),
  BillingCycle: z.enum(BillingCycle),
});


export const createCheckout = async (req: Request, res: Response) => {
  try {

    const body = PlanSChema.safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({
        message: "Invalid plan payload",
      });
    }

    const { PlanNames: planName, BillingCycle: billingCycle } = body.data;

    const plan = await prisma.plan.findFirst({
      where: {
        name: planName,
        billingCycle,
      },
    });

    if (!plan) {
      return res.status(404).json({ message: `Plan "${planName}" not found` });
    }
    if (!plan.stripePriceId) {
      return res.status(400).json({ message: "This plan has no Stripe price configured" });
    }

    const user = await prisma.user.findUnique({
      where:  { id: (req as any).userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const fe = env.FRONTEND_URL;

    const session = await stripe.checkout.sessions.create({
      mode:                "subscription",
      customer_email:      user.email,
      line_items: [{
        price:    plan.stripePriceId,
        quantity: 1,
      }],
      client_reference_id: user.id,
      metadata:            { userId: user.id, planId: plan.id },
      success_url: `${fe}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${fe}/dashboard/billing?canceled=1`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    logger.error("[createCheckout]", err);
    return res.status(500).json({ message: "Failed to create checkout session" });
  }
};

/* ─────────────────────────────────────────────────────────────
   STRIPE WEBHOOK  POST /api/v1/payment/webhook
───────────────────────────────────────────────────────────── */

// Helper: get period from sub top-level (2026-01-28.clover moved
// current_period_* from items.data[0] to the subscription root)
function getPeriod(sub: SubscriptionWithPeriod) {
  const s = sub as any;
  const start: number = s.current_period_start ?? s.items?.data?.[0]?.current_period_start;
  const end:   number = s.current_period_end   ?? s.items?.data?.[0]?.current_period_end;
  return {
    currentPeriodStart: new Date(start * 1000),
    currentPeriodEnd:   new Date(end   * 1000),
  };
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    logger.error("[webhook] Signature verification failed:", err.message);
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      /* ── Checkout completed → provision subscription ── */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (!userId || !planId) {
          logger.error("[webhook] Missing userId or planId in metadata");
          break;
        }

        const stripeSub = await stripe.subscriptions.retrieve(
          session.subscription as string
        ) as unknown as SubscriptionWithPeriod;

        const period = getPeriod(stripeSub);

        await prisma.subscription.upsert({
          where:  { userId },
          create: {
            userId,
            planId,
            stripeSubscriptionId: stripeSub.id,
            status: "ACTIVE",
            ...period,
          },
          update: {
            planId,
            stripeSubscriptionId: stripeSub.id,
            status: "ACTIVE",
            ...period,
          },
        });

        const sub = await prisma.subscription.findUnique({ where: { userId } });
        if (sub && session.amount_total) {
          await prisma.payment.create({
            data: {
              userId,
              subscriptionId: sub.id,
              amount:         session.amount_total,
              currency:       session.currency ?? "usd",
              status:         "SUCCESS",
              provider:       "stripe",
              providerId:     session.payment_intent as string,
            },
          });
        }
        break;
      }

      /* ── Renewal payment succeeded → update period + record payment ── */
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // Skip — checkout.session.completed already handles the first payment
        if (invoice.billing_reason === "subscription_create") break;
        if (typeof invoice.parent?.subscription_details?.subscription !== "string") break;

        const stripeSub = await stripe.subscriptions.retrieve(
          invoice.id, {
            expand : ['payments']
          }
        ) as unknown as SubscriptionWithPeriod;

        const period = getPeriod(stripeSub);

        await prisma.subscription.update({
          where: { stripeSubscriptionId: stripeSub.id },
          data:  { status: "ACTIVE", ...period },
        });

        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: stripeSub.id },
        });
        if (sub && invoice.amount_paid) {
          await prisma.payment.create({
            data: {
              userId:         sub.userId,
              subscriptionId: sub.id,
              amount:         invoice.amount_paid,
              currency:       invoice.currency,
              status:         "SUCCESS",
              provider:       "stripe",
              providerId:     invoice.payments?.data[0]?.payment.payment_intent as string,
            },
          });
        }
        break;
      }

      /* ── Subscription canceled ── */
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await prisma.subscription.update({
          where: { stripeSubscriptionId: stripeSub.id },
          data:  { status: "CANCELED" },
        });
        break;
      }

      /* ── Payment failed → mark PAST_DUE ── */
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        // FIX: pass the subscription ID string, not the invoice object
        if (typeof invoice.parent?.subscription_details?.subscription !== "string") break;

        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: invoice.parent.subscription_details.subscription },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data:  { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error("[webhook] Handler error:", err);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};