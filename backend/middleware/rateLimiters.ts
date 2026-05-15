import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request } from "express";
import { isProd, isTest } from "../config/env";
import { redis } from "../lib/redis";

// Use authenticated userId when present so rate limits aren't bypassed by IP rotation.
const keyByUserOrIp = (req: Request, _res: unknown) => {
  const userId = (req as any).userId as string | undefined;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

// Shared Redis store factory. Each limiter gets its own prefix so different
// limiter buckets don't collide.
function makeStore(prefix: string) {
  // In test mode skip Redis to keep unit tests offline-friendly.
  if (isTest) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // ioredis accepts variadic args; rate-limit-redis sends them through.
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  });
}

const baseConfig = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
};

// Auth: signup / signin / oauth callbacks — brute-force protection
export const authLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("auth"),
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  message: { message: "Too many auth attempts, try again later", code: "RATE_LIMITED" },
});

// Payments — Stripe checkout creation
export const paymentLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("pay"),
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  message: { message: "Too many payment requests", code: "RATE_LIMITED" },
});

// AI endpoints — usually expensive
export const aiLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("ai"),
  windowMs: 60 * 1000,
  max: isProd ? 30 : 300,
  message: { message: "AI rate limit exceeded", code: "RATE_LIMITED" },
});

// General API — broad ceiling so abusive clients don't drown the API
export const generalLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("gen"),
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 5000,
  message: { message: "Too many requests", code: "RATE_LIMITED" },
});

// Session token mint — cheap operation but no reason to allow flooding
export const sessionTokenLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("sess"),
  windowMs: 60 * 1000,
  max: isProd ? 10 : 100,
  message: { message: "Too many session-token requests", code: "RATE_LIMITED" },
});

// Password reset request — strict, hits an email channel + DB lookup
export const passwordResetLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("pwr"),
  windowMs: 60 * 60 * 1000,
  max: isProd ? 5 : 50,
  message: { message: "Too many password-reset requests, try later", code: "RATE_LIMITED" },
});

// Refresh-token endpoint — should not be hammered by a healthy client.
export const refreshLimiter = rateLimit({
  ...baseConfig,
  store: makeStore("ref"),
  windowMs: 60 * 1000,
  max: isProd ? 30 : 300,
  message: { message: "Too many refresh attempts", code: "RATE_LIMITED" },
});
