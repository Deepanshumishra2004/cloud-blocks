import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { isProd } from "../config/env";

// Use authenticated userId when present so rate limits aren't bypassed by IP rotation.
const keyByUserOrIp = (req: Request, _res: unknown) => {
  const userId = (req as any).userId as string | undefined;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

const baseConfig = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  // In prod, persist counters in Redis if you scale to >1 replica.
  // store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
};

// Auth: signup / signin / oauth callbacks — brute-force protection
export const authLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  message: { message: "Too many auth attempts, try again later", code: "RATE_LIMITED" },
});

// Payments — Stripe checkout creation
export const paymentLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  message: { message: "Too many payment requests", code: "RATE_LIMITED" },
});

// AI endpoints — usually expensive
export const aiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: isProd ? 30 : 300,
  message: { message: "AI rate limit exceeded", code: "RATE_LIMITED" },
});

// General API — broad ceiling so abusive clients don't drown the API
export const generalLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 5000,
  message: { message: "Too many requests", code: "RATE_LIMITED" },
});
