// controllers/plan.controller.ts

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { BillingCycle } from "../generated/prisma/enums";

// CREATE PLAN
export const createPlan = async (req: Request, res: Response) => {
  try {
    const { name, price, billingCycle, maxRepls, maxStorageMB, stripePriceId } = req.body;

    if (!Object.values(BillingCycle).includes(billingCycle)) {
      return res.status(400).json({ message: "Invalid repl type" });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        price,
        billingCycle,
        maxRepls,
        maxStorageMB,
        stripePriceId,
      },
    });

    return res.status(201).json(plan);
  } catch (error) {
    return res.status(400).json({ message: "Plan creation failed" });
  }
};

// DELETE PLAN
export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;

    await prisma.plan.delete({
      where: { id: planId },
    });

    return res.json({ message: "Plan deleted" });
  } catch {
    return res.status(400).json({ message: "Plan delete failed" });
  }
};

// GET ALL PLANS
export const getAllPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany();
    return res.json(plans);
  } catch {
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

// GET SINGLE PLAN
export const getSinglePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = (req as any).params;

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json(plan);
  } catch {
    return res.status(500).json({ message: "Failed to fetch plan" });
  }
};