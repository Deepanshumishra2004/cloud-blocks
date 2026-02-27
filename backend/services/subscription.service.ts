// src/services/subscription.service.ts

import { prisma } from "../lib/prisma";

export enum SubscriptionStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    CANCELED = "CANCELED",
    PAST_DUE = "PAST_DUE",
  }

export const createSubscriptionAfterPayment = async (
  userId: string,
  planId: string,
  stripeSubscriptionId: string
) => {
  // prevent duplicate subscription
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ),
    },
  });
};

export const cancelSubscription = async (userId: string) => {
  return prisma.subscription.update({
    where: { userId },
    data: {
      status: SubscriptionStatus.CANCELED,
    },
  });
};

// export const updateSubscriptionStatus = async (
//   stripeSubscriptionId: string,
//   status: SubscriptionStatus
// ) => {
//   return prisma.subscription.update({
//     where: { id },
//     data: { status },
//   });
// };

export const getUserSubscription = async (userId: string) => {
  return prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
};