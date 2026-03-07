import type { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string
}

export const requireActiveSubscription =async(req: AuthRequest, res: Response, next : NextFunction)=>{

  const userId = req.userId;
  const cacheKey = `sub:${userId}`;

  const cached = await redis.get(cacheKey);

  if(cached === "ACTIVE") return next();
  if(cached === "INACTIVE") return res.status(403).json({ message : "Active subscription required" })

  const sub = await prisma.subscription.findUnique({
    where : {userId},
    select : { status : true, currentPeriodEnd : true }
  })

  const isActive = sub?.status === "ACTIVE" && sub.currentPeriodEnd > new Date();

  await redis.set(cacheKey, isActive ? "ACTIVE" : "INACTIVE", "EX", 300);
  
  if(!isActive) return res.status(403).json({
    message : "Active subscription required"
  })
  next();
}