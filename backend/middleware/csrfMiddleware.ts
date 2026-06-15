// src/middleware/csrfMiddleware.ts
//
// Double-submit-cookie CSRF protection for state-changing methods.
//
// Skipped automatically for:
//   • GET / HEAD / OPTIONS — safe by HTTP spec
//   • Stripe webhook — verified by signature, not session cookies
//   • Routes that are unauthenticated bootstrap (sign-in / sign-up / OAuth)
//     — no session exists yet, so there's nothing to forge.

import type { NextFunction, Request, Response } from "express";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  timingSafeEqual,
} from "../lib/csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Path prefixes (matched against req.originalUrl) that bypass CSRF.
// These are public bootstrap endpoints that cannot meaningfully be CSRF'd:
// the attacker either has no session to ride (signup/signin) or the endpoint
// authenticates via its own out-of-band channel (Stripe signature, OAuth state).
const EXEMPT_PREFIXES = [
  "/api/v1/webhook",                  // Stripe — signature verified
  "/api/v1/user/signup",
  "/api/v1/user/signin",
  "/api/v1/user/signout",             // idempotent cookie-clear
  "/api/v1/user/exchange",            // one-time OAuth code
  "/api/v1/user/google",
  "/api/v1/user/github",
  "/api/v1/user/refresh",             // protected by sameSite=strict refresh cookie
  "/api/v1/user/forgot-password",
  "/api/v1/user/reset-password",
];

function getCookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== name) continue;
    return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PREFIXES.some((p) => req.originalUrl.startsWith(p))) return next();

  // CSRF only threatens cookie-borne credentials (browsers auto-attach them).
  // Native clients authenticate with `Authorization: Bearer` and carry no
  // session cookie, so there is nothing to forge — skip the double-submit check.
  const authHeader = req.headers.authorization;
  const hasBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
  const hasAuthCookie = getCookieValue(req, "cb_token") !== undefined;
  if (hasBearer && !hasAuthCookie) return next();

  const cookieToken = getCookieValue(req, CSRF_COOKIE_NAME);
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || typeof headerToken !== "string" || !headerToken) {
    return res.status(403).json({ message: "CSRF token missing", code: "CSRF_REQUIRED" });
  }

  if (!timingSafeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ message: "CSRF token invalid", code: "CSRF_INVALID" });
  }

  return next();
};
