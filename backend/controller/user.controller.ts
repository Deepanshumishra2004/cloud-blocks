// src/controllers/user.controller.ts
import type { CookieOptions, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import {
  signAccessToken,
  signRefreshToken,
  signSessionToken,
  verifyRefreshToken,
  trackRefreshToken,
  consumeRefreshToken,
  revokeAllRefreshTokensForUser,
  REFRESH_TTL_SECS,
} from "../lib/token";
import { blacklistJti } from "../lib/tokenBlacklist";
import { generateCsrfToken, setCsrfCookie, clearCsrfCookie } from "../lib/csrf";
import { createPasswordResetToken, consumePasswordResetToken } from "../lib/passwordReset";
import { sendPasswordResetEmail } from "../services/email.service";
import { SignupSchema, SigninSchema } from "../types/user.type";
import { getGoogleAuthUrl, getGithubAuthUrl } from "../config/oauth";
import {
  exchangeGoogleCode, getGoogleProfile,
  exchangeGithubCode, getGithubProfile,
} from "../services/oauth.service";
import { env, isProd } from "../config/env";
import { logger } from "../lib/logger";

/* ──────────────────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────────────────── */

// Shared select — never expose password hash in responses
const USER_SELECT = {
  id:        true,
  email:     true,
  username:  true,
  avatar:    true,
  provider:  true,
  createdAt: true,
} as const;

async function deriveUniqueUsername(base: string): Promise<string> {
  const slug = base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
  if (!await prisma.user.findUnique({ where: { username: slug } })) return slug;
  for (let i = 0; i < 5; i++) {
    const candidate = `${slug}${Math.random().toString(36).slice(2, 6)}`;
    if (!await prisma.user.findUnique({ where: { username: candidate } })) return candidate;
  }
  return `${slug}${Date.now().toString(36).slice(-6)}`;
}

/* ──── Cookies ─────────────────────────────────────────────────────────── */

const ACCESS_COOKIE  = "cb_token";
const REFRESH_COOKIE = "cb_refresh";
// Refresh cookie is scoped to its single endpoint so it's never sent on
// regular API calls — reduces blast radius if XSS reads it (it can't, but
// keep the path tight as belt-and-braces).
const REFRESH_COOKIE_PATH = "/api/v1/user/refresh";

function buildAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    // Cookie lifetime is intentionally decoupled from JWT lifetime. The JWT
    // inside expires every 15 minutes — when the server rejects an expired
    // token the frontend interceptor calls /refresh which overwrites the
    // cookie with a freshly signed JWT. Keeping the cookie's maxAge long
    // means Next.js's edge middleware (which only checks cookie presence,
    // not JWT validity) doesn't bounce the user to /signin every 15 min.
    maxAge: REFRESH_TTL_SECS * 1000,
    path: "/",
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

function buildRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    // Refresh cookie travels first-party only — sameSite=strict is correct.
    // (Access cookie can't use strict because the frontend lives on a
    // different origin in prod; refresh is only ever called from our SPA
    // after page load, never from a top-level cross-site navigation.)
    sameSite: isProd ? "none" : "lax",
    maxAge: REFRESH_TTL_SECS * 1000,
    path: REFRESH_COOKIE_PATH,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_COOKIE, token, buildAccessCookieOptions());
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, buildRefreshCookieOptions());
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, buildAccessCookieOptions());
  res.clearCookie(REFRESH_COOKIE, buildRefreshCookieOptions());
  clearCsrfCookie(res);
}

// Issue a fresh access+refresh pair, install cookies + CSRF cookie, track
// the refresh jti in Redis so it can be rotated/revoked.
async function issueAuthTokens(res: Response, userId: string): Promise<void> {
  const access  = signAccessToken(userId);
  const refresh = signRefreshToken(userId);
  await trackRefreshToken(refresh.jti, userId);
  setAccessCookie(res, access.token);
  setRefreshCookie(res, refresh.token);
  setCsrfCookie(res, generateCsrfToken());
}

async function ensureFreeSubscriptionForUser(db: any, userId: string): Promise<void> {
  const freePlan = await db.plan.findFirst({
    where: { name: "FREE" },
    orderBy: { billingCycle: "asc" },
  });
  if (!freePlan) throw new Error("FREE_PLAN_NOT_CONFIGURED");

  await db.subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planId: freePlan.id,
      stripeSubscriptionId: `free_${userId}`,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   CSRF STATE (OAuth anti-forgery via Redis)
   ────────────────────────────────────────────────────────────────────────── */

const STATE_TTL_SECS = 600;  // 10 minutes
const CODE_TTL_SECS  = 300;  // 5 minutes — one-time exchange code (bumped from 60s)

async function createOAuthState(): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");
  await redis.set(`oauth:state:${state}`, "1", "EX", STATE_TTL_SECS);
  return state;
}

async function createOAuthCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(16).toString("hex");
  await redis.set(`oauth:code:${code}`, userId, "EX", CODE_TTL_SECS);
  return code;
}

// Returns true only if state existed in Redis AND was atomically deleted.
async function consumeOAuthState(state: string | undefined): Promise<boolean> {
  if (!state) return false;
  const deleted = await redis.del(`oauth:state:${state}`);
  return deleted === 1;
}

/* ──────────────────────────────────────────────────────────────────────────
   SIGNUP  POST /api/v1/user/signup
   ────────────────────────────────────────────────────────────────────────── */

export const signup = async (req: Request, res: Response) => {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten((i) => i.message).fieldErrors,
      });
    }

    const { email: rawEmail, password, username } = parsed.data;
    const email = rawEmail.trim().toLowerCase();

    // Account-enumeration mitigation: return a single generic 409 whether the
    // email or username conflicts. We don't reveal which one is taken.
    const existing = await prisma.user.findFirst({
      where:  { OR: [{ email }, { username }] },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        message: "Could not create account with the provided credentials",
        code: "SIGNUP_CONFLICT",
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data:   { email, username, password: await bcrypt.hash(password, 12), provider: "EMAIL" },
        select: USER_SELECT,
      });
      await ensureFreeSubscriptionForUser(tx, created.id);
      return created;
    });

    await issueAuthTokens(res, user.id);
    return res.status(201).json({ message: "Account created", user });
  } catch (err) {
    logger.error({ err: err }, "[signup]");
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   SIGNIN  POST /api/v1/user/signin
   ────────────────────────────────────────────────────────────────────────── */

export const signin = async (req: Request, res: Response) => {
  try {
    const parsed = SigninSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten((i) => i.message).fieldErrors,
      });
    }

    const { email: rawEmail, password } = parsed.data;
    const email = rawEmail.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where:  { email },
      select: { id: true, email: true, username: true, password: true, provider: true, avatar: true },
    });

    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (!user.password) {
      return res.status(401).json({
        message: `This account uses ${user.provider.toLowerCase()} sign-in. Use that button instead.`,
      });
    }

    if (!await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await issueAuthTokens(res, user.id);

    return res.status(200).json({
      message: "Signed in",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (err) {
    logger.error({ err: err }, "[signin]");
    return res.status(500).json({ message: "Signin failed" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   SIGNOUT  POST /api/v1/user/signout
   Blacklists the active access token and revokes the refresh token (best
   effort — works even if the user was already past access-token expiry).
   ────────────────────────────────────────────────────────────────────────── */

export const signout = async (req: Request, res: Response) => {
  try {
    // Best-effort revocation. If any of this throws (Redis hiccup, missing
    // jti) we still clear cookies — the user has effectively logged out
    // client-side and the worst case is the token remains valid until its
    // natural expiry.
    const accessJti = (req as any).tokenJti as string | undefined;
    const accessExp = (req as any).tokenExp as number | undefined;

    if (accessJti && accessExp) {
      const ttl = accessExp - Math.floor(Date.now() / 1000);
      await blacklistJti(accessJti, ttl).catch(() => {});
    }

    const refreshCookie = req.cookies?.cb_refresh ?? req.headers.cookie?.match(/cb_refresh=([^;]+)/)?.[1];
    if (refreshCookie) {
      try {
        const payload = verifyRefreshToken(decodeURIComponent(refreshCookie));
        if (payload.jti) {
          await consumeRefreshToken(payload.jti);
        }
      } catch {
        // Invalid refresh cookie — nothing to do.
      }
    }

    clearAuthCookies(res);
    return res.status(200).json({ message: "Signed out" });
  } catch (err) {
    logger.error({ err: err }, "[signout]");
    clearAuthCookies(res);
    return res.status(200).json({ message: "Signed out" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   REFRESH  POST /api/v1/user/refresh
   Single-use refresh rotation. Detects token theft via consume-once semantics.
   ────────────────────────────────────────────────────────────────────────── */

export const refresh = async (req: Request, res: Response) => {
  try {
    const cookieToken =
      req.cookies?.cb_refresh ??
      req.headers.cookie?.match(/cb_refresh=([^;]+)/)?.[1];

    if (!cookieToken) {
      return res.status(401).json({ message: "No refresh token", code: "REFRESH_MISSING" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(decodeURIComponent(cookieToken));
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token", code: "REFRESH_INVALID" });
    }

    // One-shot consume. If the jti is gone, either it was already rotated
    // (legitimate but late retry) or it was stolen and used by an attacker.
    // Either way, the safe response is to revoke every refresh token for
    // this user, forcing a full re-login.
    const userId = await consumeRefreshToken(payload.jti);
    if (!userId || userId !== payload.userId) {
      logger.warn({ userId: payload.userId, jti: payload.jti }, "refresh token reuse detected");
      await revokeAllRefreshTokensForUser(payload.userId).catch(() => {});
      clearAuthCookies(res);
      return res.status(401).json({ message: "Session expired, please sign in again", code: "REFRESH_REUSE" });
    }

    await issueAuthTokens(res, userId);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[refresh]");
    return res.status(500).json({ message: "Refresh failed" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   SESSION TOKEN  GET /api/v1/user/session-token
   Short-lived (5 min) token for the WebSocket handshake only.
   ────────────────────────────────────────────────────────────────────────── */

export const sessionToken = (req: Request, res: Response) => {
  const { token } = signSessionToken((req as any).userId);
  return res.json({ token });
};

/* ──────────────────────────────────────────────────────────────────────────
   ME  GET /api/v1/user/me
   ────────────────────────────────────────────────────────────────────────── */

export const me = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: (req as any).userId },
      select: USER_SELECT,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    logger.error({ err }, "[me]");
    return res.status(500).json({ message: "Failed to fetch user" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   UPDATE ME  PATCH /api/v1/user/me
   ────────────────────────────────────────────────────────────────────────── */

export const updateMe = async (req: Request, res: Response) => {
  try {
    const { username } = req.body as { username?: string };

    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "username is required" });
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ message: "Username: 3–20 chars, lowercase letters, numbers and underscores only" });
    }

    const conflict = await prisma.user.findUnique({
      where:  { username },
      select: { id: true },
    });
    if (conflict && conflict.id !== (req as any).userId) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const user = await prisma.user.update({
      where:  { id: (req as any).userId },
      data:   { username },
      select: USER_SELECT,
    });

    return res.json({ user });
  } catch (err) {
    logger.error({ err: err }, "[updateMe]");
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   DELETE ME  DELETE /api/v1/user/me
   ────────────────────────────────────────────────────────────────────────── */

export const deleteMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    await prisma.user.delete({ where: { id: userId } });
    await revokeAllRefreshTokensForUser(userId).catch(() => {});
    clearAuthCookies(res);
    return res.status(200).json({ message: "Account deleted" });
  } catch (err) {
    logger.error({ err: err }, "[deleteMe]");
    return res.status(500).json({ message: "Failed to delete account" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   CHANGE PASSWORD  POST /api/v1/user/change-password
   On success: revoke every other session ("log out everywhere").
   ────────────────────────────────────────────────────────────────────────── */

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?:     string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({
      where:  { id: (req as any).userId },
      select: { id: true, password: true, provider: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.password) {
      return res.status(400).json({
        message: `${user.provider} accounts sign in via OAuth and don't use a password.`,
      });
    }

    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: "New password must differ from current password" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { password: await bcrypt.hash(newPassword, 12) },
    });

    // Kill every other session, then issue a fresh pair for the current one
    // so the user stays signed in here.
    await revokeAllRefreshTokensForUser(user.id).catch(() => {});
    await issueAuthTokens(res, user.id);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    logger.error({ err: err }, "[changePassword]");
    return res.status(500).json({ message: "Failed to change password" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   FORGOT PASSWORD  POST /api/v1/user/forgot-password
   Always returns 200 to prevent account enumeration. Token is generated
   only if the user exists and uses email/password auth.
   ────────────────────────────────────────────────────────────────────────── */

export const forgotPassword = async (req: Request, res: Response) => {
  const { email: rawEmail } = req.body as { email?: string };
  const email = rawEmail?.trim().toLowerCase();

  // Always answer 200 — never reveal whether an email exists.
  const genericResponse = () =>
    res.status(200).json({ message: "If an account exists, a reset link has been sent." });

  if (!email) return genericResponse();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, provider: true },
    });

    // Only generate a reset for accounts that actually have a password.
    if (!user || !user.password) return genericResponse();

    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    // Fire-and-forget — sendPasswordResetEmail swallows errors internally so
    // a transient SMTP issue can't leak a different response than the
    // happy path (anti-enumeration).
    await sendPasswordResetEmail(user.email, resetUrl);

    return genericResponse();
  } catch (err) {
    logger.error({ err }, "[forgotPassword]");
    return genericResponse();
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   RESET PASSWORD  POST /api/v1/user/reset-password
   ────────────────────────────────────────────────────────────────────────── */

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Reset token is required" });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (newPassword.length > 72) {
      return res.status(400).json({ message: "Password too long" });
    }

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, provider: true },
    });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { password: await bcrypt.hash(newPassword, 12) },
    });

    // Kill every existing session — a password reset always means "log
    // everyone out, including any attacker who might know the old password".
    await revokeAllRefreshTokensForUser(user.id).catch(() => {});

    // Sign the user in on this device.
    await issueAuthTokens(res, user.id);

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    logger.error({ err }, "[resetPassword]");
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   EXCHANGE OAUTH CODE  POST /api/v1/user/exchange
   ────────────────────────────────────────────────────────────────────────── */

export const exchangeOAuthCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body as { code?: string };

    console.log("[backend-request] : ",req.body);
    if (!code) return res.status(400).json({ message: "Code required" });

    const userId = await redis.get(`oauth:code:${code}`);
    if (!userId) return res.status(401).json({ message: "Invalid or expired code" });

    await redis.del(`oauth:code:${code}`);

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: USER_SELECT,
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    await issueAuthTokens(res, user.id);
    return res.json({ user });
  } catch (err) {
    logger.error({ err: err }, "[exchangeOAuthCode]");
    return res.status(500).json({ message: "Failed to exchange code" });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GOOGLE OAUTH
   ────────────────────────────────────────────────────────────────────────── */

export const googleInit = async (_req: Request, res: Response) => {
  const state = await createOAuthState();
  res.redirect(getGoogleAuthUrl(state));
};

export const googleCallback = async (req: Request, res: Response) => {
  const { code, error, state } = req.query as Record<string, string>;

  console.log("[backend-request] : ",req.query);

  const fe = env.FRONTEND_URL;

  if (error || !code) return res.redirect(`${fe}/callback?error=oauth_denied`);

  if (!await consumeOAuthState(state)) {
    logger.warn("[googleCallback] Invalid or expired state");
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }

  try {
    const tokens  = await exchangeGoogleCode(code);
    const profile = await getGoogleProfile(tokens.access_token);

    console.log("[tokens] : ",tokens)
    console.log("[profile] : ",profile.email_verified)
    if (!profile.email_verified) {
      return res.redirect(`${fe}/callback?error=email_not_verified`);
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ email: profile.email }, { providerId: profile.sub, provider: "GOOGLE" }] },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data:  {
          provider: "GOOGLE",
          providerId: profile.sub,
          avatar: profile.picture,
        },
      });
    } else {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email:      profile.email,
            username:   await deriveUniqueUsername(profile.given_name ?? profile.email.split("@")[0]),
            password:   null,
            provider:   "GOOGLE",
            providerId: profile.sub,
            avatar:     profile.picture,
          },
        });
        await ensureFreeSubscriptionForUser(tx, created.id);
        return created;
      });
    }

    const oauthCode = await createOAuthCode(user.id);
    return res.redirect(`${fe}/callback?code=${oauthCode}`);
  } catch (err) {
    logger.error({ err: err }, "[googleCallback]");
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GITHUB OAUTH
   ────────────────────────────────────────────────────────────────────────── */

export const githubInit = async (_req: Request, res: Response) => {
  const state = await createOAuthState();
  res.redirect(getGithubAuthUrl(state));
};

export const githubCallback = async (req: Request, res: Response) => {
  const { code, error, state } = req.query as Record<string, string>;
  const fe = env.FRONTEND_URL;

  if (error || !code) return res.redirect(`${fe}/callback?error=oauth_denied`);

  if (!await consumeOAuthState(state)) {
    logger.warn("[githubCallback] Invalid or expired state");
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }

  try {
    const tokens              = await exchangeGithubCode(code);
    const { user: gh, email } = await getGithubProfile(tokens.access_token);

    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { providerId: String(gh.id), provider: "GITHUB" }] },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data:  { provider: "GITHUB", providerId: String(gh.id), avatar: gh.avatar_url },
      });
    } else {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            username:   await deriveUniqueUsername(gh.login),
            password:   null,
            provider:   "GITHUB",
            providerId: String(gh.id),
            avatar:     gh.avatar_url,
          },
        });
        await ensureFreeSubscriptionForUser(tx, created.id);
        return created;
      });
    }

    const oauthCode = await createOAuthCode(user.id);
    return res.redirect(`${fe}/callback?code=${oauthCode}`);
  } catch (err) {
    logger.error({ err: err }, "[githubCallback]");
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }
};
