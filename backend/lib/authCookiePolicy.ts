import type { CookieOptions } from "express";

export function getAuthCookieSecurity(isProd: boolean): Pick<CookieOptions, "secure" | "sameSite"> {
  return {
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  };
}
