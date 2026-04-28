import rateLimit from "express-rate-limit";

// 20 AI requests per user per minute
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as any).userId ?? req.ip ?? "unknown",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many AI requests. Please wait a moment." },
});
