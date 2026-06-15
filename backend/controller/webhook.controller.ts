import type { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import type { SubscriptionStatus } from "../generated/prisma/enums";

// â”€â”€ moved outside handler so it's not recreated on every request â”€â”€
const mapStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
  switch (status) {
    case "active":             return "ACTIVE";
    case "canceled":           return "CANCELED";
    case "past_due":           return "PAST_DUE";
    case "trialing":           return "TRIAL";
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":             return "EXPIRED";
    default:                   return "EXPIRED";
  }
};

// Drop the `sub:<userId>` status cache so requireActiveSubscription re-reads the
// DB on the next request instead of serving a stale ACTIVE/INACTIVE for up to 5min.
const invalidateSubCache = async (userId?: string | null) => {
  if (!userId) return;
  try { await redis.del(`sub:${userId}`); }
  catch (err) { logger.error({ err }, "[webhook] failed to invalidate sub cache"); }
};

const getPeriod = (subscription: Stripe.Subscription) => {
  const item = subscription.items.data[0];
  if (!item?.current_period_start || !item?.current_period_end) {
    throw new Error(`Missing period data on subscription ${subscription.id}`);
  }
  return {
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd:   new Date(item.current_period_end   * 1000),
  };
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  // â”€â”€ 1. verify signature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error({ err: err }, "[webhook] signature verification failed");
    return res.status(400).send("Webhook Error");
  }

  logger.info(`[webhook] received eventId=${event.id} type=${event.type}`);

  // â”€â”€ 2. handle events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  try {
    const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (seen) {
      logger.info(`[webhook] duplicate event ${event.id}, skipping`);
      return res.json({ received: true });
    }

    switch (event.type) {

      // â”€â”€ SUBSCRIPTION CREATED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;

        // validate metadata before touching the DB
        const { userId, planId } = subscription.metadata;
        if (!userId || !planId) {
          logger.error(`[webhook] missing metadata on subscription ${subscription.id}`);
          break;
        }

        // validate plan exists to avoid FK violation
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          logger.error(`[webhook] plan not found: ${planId}`);
          break;
        }

        // idempotency check
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (existing) {
          logger.info(`[webhook] subscription already exists, skipping ${subscription.id}`);
          break;
        }

        await prisma.subscription.create({
          data: {
            userId,
            planId,
            stripeSubscriptionId: subscription.id,
            status: mapStatus(subscription.status),
            ...getPeriod(subscription),
          },
        });

        await invalidateSubCache(userId);
        logger.info(`[webhook] subscription created for userId=${userId}`);
        break;
      }

      // â”€â”€ SUBSCRIPTION UPDATED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // upsert so a missed "created" event doesn't crash here
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: subscription.id },
          update: {
            status: mapStatus(subscription.status),
            ...getPeriod(subscription),
          },
          create: {
            userId:               subscription.metadata.userId!,
            planId:               subscription.metadata.planId!,
            stripeSubscriptionId: subscription.id,
            status:               mapStatus(subscription.status),
            ...getPeriod(subscription),
          },
        });

        await invalidateSubCache(subscription.metadata.userId);
        logger.info(`[webhook] subscription updated ${subscription.id}`);
        break;
      }

      // â”€â”€ SUBSCRIPTION DELETED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // DO NOT call stripe.subscriptions.cancel() here â€”
        // this event fires AFTER Stripe has already canceled it.
        // Calling cancel again would throw a "already canceled" error.
        const updated = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data:  { status: "CANCELED" },
        });

        if (updated.count === 0) {
          logger.warn(`[webhook] subscription not found for deletion ${subscription.id}`);
        }

        await invalidateSubCache(subscription.metadata.userId);
        logger.info(`[webhook] subscription canceled ${subscription.id}`);
        break;
      }

      // â”€â”€ PAYMENT SUCCESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        const stripeSubscriptionId =
          invoice.parent?.type === "subscription_details"
            ? (invoice.parent.subscription_details?.subscription as string | null)
            : null;

        if (!stripeSubscriptionId) break;

        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId },
        });
        if (!sub) {
          logger.warn(`[webhook] no subscription found for invoice ${invoice.id}`);
          break;
        }

        // idempotency â€” prevent duplicate payment rows on Stripe retries
        const existingPayment = await prisma.payment.findFirst({
          where: { providerId: invoice.id },
        });
        if (existingPayment) {
          logger.info(`[webhook] payment already recorded for invoice ${invoice.id}`);
          break;
        }

        await prisma.payment.create({
          data: {
            userId:         sub.userId,
            subscriptionId: sub.id,
            amount:         invoice.amount_paid,
            currency:       invoice.currency,
            status:         "SUCCESS",
            provider:       "stripe",
            providerId:     invoice.id,
          },
        });

        await invalidateSubCache(sub.userId);
        logger.info(`[webhook] payment recorded for invoiceId=${invoice.id}`);
        break;
      }

      // â”€â”€ PAYMENT FAILED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const stripeSubscriptionId =
          invoice.parent?.type === "subscription_details"
            ? (invoice.parent.subscription_details?.subscription as string | null)
            : null;

        if (!stripeSubscriptionId) break;

        const updated = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data:  { status: "PAST_DUE" },
        });

        if (updated.count === 0) {
          logger.warn(`[webhook] no subscription found for failed invoice ${invoice.id}`);
        }

        const failedSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId },
          select: { userId: true },
        });
        await invalidateSubCache(failedSub?.userId);
        logger.info(`[webhook] subscription marked PAST_DUE for invoiceId=${invoice.id}`);
        break;
      }

      default:
        logger.info(`[webhook] unhandled event type: ${event.type}`);
    }

    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
    return res.json({ received: true });

  } catch (err) {
    logger.error(`[webhook] handler error eventId=${event.id}`, err);
    return res.status(500).send("Server error");
  }
};
