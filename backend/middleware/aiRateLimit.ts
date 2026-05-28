import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const keyByUserOrIp = (req: Request) => {
  const userId = (req as any).userId as string | undefined;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

// 20 AI requests per user per minute
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: keyByUserOrIp,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many AI requests. Please wait a moment." },
});
