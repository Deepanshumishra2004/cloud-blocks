// src/middleware/auth.middleware.ts
//
// Verifies an access token from either:
//   1. HttpOnly cookie  cb_token       (browser flow)
//   2. Authorization: Bearer <token>   (API / WS / mobile)
//
// On success attaches `userId` and `tokenJti` to the request so downstream
// handlers (logout, etc.) can revoke this specific token.

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/token";
import { isBlacklisted } from "../lib/tokenBlacklist";

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

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined = getCookieValue(req, "cb_token");

    if (!token) {
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        token = auth.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required", code: "AUTH_REQUIRED" });
    }

    const payload = verifyAccessToken(token);
    if (!payload.userId || !payload.jti) {
      return res.status(401).json({ message: "Invalid token", code: "AUTH_INVALID" });
    }

    // Revocation check — keeps token reuse-after-logout from working.
    if (await isBlacklisted(payload.jti)) {
      return res.status(401).json({ message: "Token revoked", code: "AUTH_REVOKED" });
    }

    (req as any).userId = payload.userId;
    (req as any).tokenJti = payload.jti;
    (req as any).tokenExp = payload.exp;

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token", code: "AUTH_INVALID" });
  }
};
