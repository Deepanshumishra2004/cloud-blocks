// src/lib/csrf.ts
//
// Double-submit-cookie CSRF protection.
//
// On any successful authentication we set a non-httpOnly `cb_csrf` cookie
// containing a random token. The frontend reads that cookie and echoes its
// value back in the `X-CSRF-Token` header on every state-changing request.
// The CSRF middleware compares the cookie value with the header using a
// timing-safe comparison.
//
// Because a cross-site attacker cannot read cookies from another origin
// (same-origin policy), they cannot forge a matching header — even if the
// auth cookie auto-rides the request.

import crypto from "crypto";
import type { CookieOptions, Response } from "express";
import { env, isProd } from "../config/env";
import { getAuthCookieSecurity } from "./authCookiePolicy";

export const CSRF_COOKIE_NAME = "cb_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function buildCsrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,                         // frontend JS must read this
    ...getAuthCookieSecurity(isProd),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions());
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, buildCsrfCookieOptions());
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
