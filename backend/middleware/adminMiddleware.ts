import type { Request, Response, NextFunction } from "express";
import { env, isProd } from "../config/env";
import { logger } from "../lib/logger";

const ADMIN_IDS = new Set(
  (env.ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);

if (ADMIN_IDS.size === 0) {
  const msg = "ADMIN_IDS is empty — no users have admin privileges";
  if (isProd) {
    // Boot-time visibility: not fatal (a service may legitimately ship without
    // admins) but make it loud so misconfiguration doesn't silently grant
    // nobody access.
    logger.warn(msg);
  } else {
    logger.info(msg);
  }
}

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).userId as string | undefined;
  if (!userId || !ADMIN_IDS.has(userId)) {
    logger.warn({ userId, path: req.originalUrl }, "admin check failed");
    return res.status(403).json({ message: "Forbidden", code: "FORBIDDEN" });
  }
  next();
};
