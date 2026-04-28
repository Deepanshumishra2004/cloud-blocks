// src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/token";

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== name) continue;
    return decodeURIComponent(rest.join("="));
  }

  return undefined;
}

/**
 * Reads JWT from:
 *  1. HttpOnly cookie  cb_token    (preferred — browser flow)
 *  2. Authorization: Bearer <token> header (API / mobile clients)
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Cookie
    let token: string | undefined = getCookieValue(req, "cb_token");

    // 2. Bearer header
    if (!token) {
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        token = auth.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyToken(token);
    (req as any).userId = payload.userId;

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
