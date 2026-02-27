import type { Response } from "express";
import type { AuthRequest } from "../middleware/authMiddleware";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { BillingCycle } from "../generated/prisma/enums";
import { createCheckoutSession } from "../services/payment.service";

export const createCheckout = async (req : AuthRequest , res : Response)=>{
    const { planId } = (req as any).body;

    const userId = req.userId;
  
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
      });
  
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
    }

    const session = await createCheckoutSession(userId!, planId)

    res.json({ url : session.url })
}