import type { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import type { SubscriptionStatus } from "../generated/prisma/enums";

// ── moved outside handler so it's not recreated on every request ──
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

  // ── 1. verify signature ──────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return res.status(400).send("Webhook Error");
  }

  console.log(`[webhook] received eventId=${event.id} type=${event.type}`);

  // ── 2. handle events ─────────────────────────────────────────────
  try {
    switch (event.type) {

      // ── SUBSCRIPTION CREATED ──────────────────────────────────────
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;

        // validate metadata before touching the DB
        const { userId, planId } = subscription.metadata;
        if (!userId || !planId) {
          console.error(`[webhook] missing metadata on subscription ${subscription.id}`);
          break;
        }

        // validate plan exists to avoid FK violation
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          console.error(`[webhook] plan not found: ${planId}`);
          break;
        }

        // idempotency check
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (existing) {
          console.log(`[webhook] subscription already exists, skipping ${subscription.id}`);
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

        console.log(`[webhook] subscription created for userId=${userId}`);
        break;
      }

      // ── SUBSCRIPTION UPDATED ──────────────────────────────────────
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

        console.log(`[webhook] subscription updated ${subscription.id}`);
        break;
      }

      // ── SUBSCRIPTION DELETED ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // DO NOT call stripe.subscriptions.cancel() here —
        // this event fires AFTER Stripe has already canceled it.
        // Calling cancel again would throw a "already canceled" error.
        const updated = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data:  { status: "CANCELED" },
        });

        if (updated.count === 0) {
          console.warn(`[webhook] subscription not found for deletion ${subscription.id}`);
        }

        console.log(`[webhook] subscription canceled ${subscription.id}`);
        break;
      }

      // ── PAYMENT SUCCESS ───────────────────────────────────────────
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
          console.warn(`[webhook] no subscription found for invoice ${invoice.id}`);
          break;
        }

        // idempotency — prevent duplicate payment rows on Stripe retries
        const existingPayment = await prisma.payment.findFirst({
          where: { providerId: invoice.id },
        });
        if (existingPayment) {
          console.log(`[webhook] payment already recorded for invoice ${invoice.id}`);
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

        console.log(`[webhook] payment recorded for invoiceId=${invoice.id}`);
        break;
      }

      // ── PAYMENT FAILED ────────────────────────────────────────────
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
          console.warn(`[webhook] no subscription found for failed invoice ${invoice.id}`);
        }

        console.log(`[webhook] subscription marked PAST_DUE for invoiceId=${invoice.id}`);
        break;
      }

      default:
        console.log(`[webhook] unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error(`[webhook] handler error eventId=${event.id}`, err);
    return res.status(500).send("Server error");
  }
};