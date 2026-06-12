import { prisma } from "../lib/prisma";
import {
  FREE_REPL_FALLBACK,
  FREE_STORAGE_MB_FALLBACK,
  canCreateRepl,
  formatReplLimit,
  isUnlimitedLimit,
} from "./plan-limit-rules";

export {
  FREE_REPL_FALLBACK,
  FREE_STORAGE_MB_FALLBACK,
  canCreateRepl,
  formatReplLimit,
  isUnlimitedLimit,
};

const FREE_SUBSCRIPTION_YEARS = 100;

export async function getOrCreateActiveSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (existing) return existing;

  const freePlan = await prisma.plan.findFirst({
    where: { name: "FREE" },
    orderBy: { billingCycle: "asc" },
  });

  if (!freePlan) return null;

  return prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planId: freePlan.id,
      stripeSubscriptionId: `free_${userId}`,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + FREE_SUBSCRIPTION_YEARS * 365 * 24 * 60 * 60 * 1000),
    },
    include: { plan: true },
  });
}

export async function getUserReplUsage(userId: string) {
  const [replCount, subscription] = await Promise.all([
    prisma.repl.count({ where: { userId } }),
    getOrCreateActiveSubscription(userId),
  ]);

  return {
    replCount,
    subscription,
    maxRepls: subscription?.plan.maxRepls ?? FREE_REPL_FALLBACK,
    maxStorageMB: subscription?.plan.maxStorageMB ?? FREE_STORAGE_MB_FALLBACK,
  };
}
