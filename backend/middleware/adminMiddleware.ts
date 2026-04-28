import type { Request, Response, NextFunction } from "express";

const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!ADMIN_IDS.has((req as any).userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
