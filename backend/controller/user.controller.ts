// src/controllers/user.controller.ts
import type { CookieOptions, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma }                             from "../lib/prisma";
import { redis }                              from "../lib/redis";
import { signToken }                          from "../lib/token";
import { SignupSchema, SigninSchema }          from "../types/user.type";
import { getGoogleAuthUrl, getGithubAuthUrl } from "../config/oauth";
import {
  exchangeGoogleCode, getGoogleProfile,
  exchangeGithubCode, getGithubProfile,
} from "../services/oauth.service";

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

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
  const exists = await prisma.user.findUnique({ where: { username: slug } });
  if (!exists) return slug;
  return `${slug}${Math.random().toString(36).slice(2, 6)}`;
}

function buildAuthCookieOptions(): CookieOptions {
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

function sendTokenCookie(res: Response, token: string) {
  res.cookie("cb_token", token, buildAuthCookieOptions());
}

function clearTokenCookie(res: Response) {
  res.clearCookie("cb_token", buildAuthCookieOptions());
}

async function ensureFreeSubscriptionForUser(db: any, userId: string): Promise<void> {
  const freePlan = await db.plan.findFirst({
    where: { name: "FREE" },
    orderBy: { billingCycle: "asc" }, // MONTHLY before YEARLY in enum ordering
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

/* ─────────────────────────────────────────────────────────────
   CSRF STATE  (OAuth anti-forgery via Redis)
───────────────────────────────────────────────────────────── */

const STATE_TTL_SECS = 600; // 10 minutes

async function createOAuthState(): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  await redis.set(`oauth:state:${state}`, "1", "EX", STATE_TTL_SECS);
  return state;
}

// Returns true only if state existed in Redis AND was atomically deleted.
// One-time use: replaying the same callback URL always fails.
async function consumeOAuthState(state: string | undefined): Promise<boolean> {
  if (!state) return false;
  const deleted = await redis.del(`oauth:state:${state}`); // returns 1 or 0
  return deleted === 1;
}

/* ─────────────────────────────────────────────────────────────
   SIGNUP  POST /api/v1/user/signup
───────────────────────────────────────────────────────────── */

export const signup = async (req: Request, res: Response) => {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password, username } = parsed.data;

    const existing = await prisma.user.findFirst({
      where:  { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing?.email    === email)    return res.status(409).json({ message: "Email already in use" });
    if (existing?.username === username) return res.status(409).json({ message: "Username already taken" });

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data:   { email, username, password: await bcrypt.hash(password, 12), provider: "EMAIL" },
        select: USER_SELECT,
      });
      await ensureFreeSubscriptionForUser(tx, created.id);
      return created;
    });

    const token = signToken(user.id);
    sendTokenCookie(res, token);
    return res.status(201).json({ message: "Account created", user });
  } catch (err) {
    console.error("[signup]", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ─────────────────────────────────────────────────────────────
   SIGNIN  POST /api/v1/user/signin
───────────────────────────────────────────────────────────── */

export const signin = async (req: Request, res: Response) => {
  try {
    const parsed = SigninSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors:  parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    // Need password field for bcrypt compare — not in USER_SELECT
    const user = await prisma.user.findUnique({
      where:  { email },
      select: { id: true, email: true, username: true, password: true, provider: true, avatar: true },
    });

    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (!user.password) {
      // OAuth user trying to sign in with password
      return res.status(401).json({
        message: `This account uses ${user.provider.toLowerCase()} sign-in. Use that button instead.`,
      });
    }

    if (!await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user.id);

    sendTokenCookie(res, token);

    return res.status(200).json({
      message: "Signed in",
      user: { id: user.id,
        email: user.email, 
        username: user.username, 
        avatar: user.avatar, 
        provider: user.provider 
      },
    });
    
  } catch (err) {
    console.error("[signin]", err);
    return res.status(500).json({ message: "Signin failed" });
  }
};

/* ─────────────────────────────────────────────────────────────
   SIGNOUT  POST /api/v1/user/signout
───────────────────────────────────────────────────────────── */

export const signout = (_req: Request, res: Response) => {
  clearTokenCookie(res);
  return res.status(200).json({ message: "Signed out" });
};

export const sessionToken = (req: Request, res: Response) => {
  const token = signToken((req as any).userId);
  return res.json({ token });
};

/* ─────────────────────────────────────────────────────────────
   ME  GET /api/v1/user/me
───────────────────────────────────────────────────────────── */

export const me = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: (req as any).userId },
      select: USER_SELECT,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch {
    return res.status(500).json({ message: "Failed to fetch user" });
  }
};

/* ─────────────────────────────────────────────────────────────
   UPDATE ME  PATCH /api/v1/user/me
   Called by: settings page (username update)
───────────────────────────────────────────────────────────── */

export const updateMe = async (req: Request, res: Response) => {
  try {
    const { username } = req.body as { username?: string };

    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "username is required" });
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ message: "Username: 3–20 chars, lowercase letters, numbers and underscores only" });
    }

    // Collision check — exclude self so no-op saves don't 409
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
    console.error("[updateMe]", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE ME  DELETE /api/v1/user/me
   Called by: settings page danger zone
   Schema has onDelete: Cascade on Repl and Payment — DB handles cleanup.
───────────────────────────────────────────────────────────── */

export const deleteMe = async (req: Request, res: Response) => {
  try {
    // Cascade deletes: repls, payments (via schema onDelete: Cascade)
    // Subscription is also Cascade via User relation
    await prisma.user.delete({ where: { id: (req as any).userId } });
    clearTokenCookie(res);
    return res.status(200).json({ message: "Account deleted" });
  } catch (err) {
    console.error("[deleteMe]", err);
    return res.status(500).json({ message: "Failed to delete account" });
  }
};

/* ─────────────────────────────────────────────────────────────
   CHANGE PASSWORD  POST /api/v1/user/change-password
   Called by: settings page (email accounts only)
───────────────────────────────────────────────────────────── */

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

    // OAuth accounts never have a password
    if (!user.password) {
      return res.status(400).json({
        message: `${user.provider} accounts sign in via OAuth and don't use a password.`,
      });
    }

    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Prevent re-using the same password
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: "New password must differ from current password" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { password: await bcrypt.hash(newPassword, 12) },
    });

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("[changePassword]", err);
    return res.status(500).json({ message: "Failed to change password" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GOOGLE OAUTH
───────────────────────────────────────────────────────────── */

export const googleInit = async (_req: Request, res: Response) => {
  const state = await createOAuthState();
  res.redirect(getGoogleAuthUrl(state));
};

export const googleCallback = async (req: Request, res: Response) => {
  const { code, error, state } = req.query as Record<string, string>;
  const fe = process.env.FRONTEND_URL ?? "http://localhost:3000";

  if (error || !code) return res.redirect(`${fe}/callback?error=oauth_denied`);

  if (!await consumeOAuthState(state)) {
    console.warn("[googleCallback] Invalid or expired state");
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }

  try {
    const tokens  = await exchangeGoogleCode(code);
    const profile = await getGoogleProfile(tokens.access_token);

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
          avatar: profile.picture 
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

    const token = signToken(user.id);
    sendTokenCookie(res, token);
    return res.redirect(`${fe}/callback`);
  } catch (err) {
    console.error("[googleCallback]", err);
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }
};

/* ─────────────────────────────────────────────────────────────
   GITHUB OAUTH
───────────────────────────────────────────────────────────── */

export const githubInit = async (_req: Request, res: Response) => {
  const state = await createOAuthState();
  res.redirect(getGithubAuthUrl(state));
};

export const githubCallback = async (req: Request, res: Response) => {
  const { code, error, state } = req.query as Record<string, string>;
  const fe = process.env.FRONTEND_URL ?? "http://localhost:3000";

  if (error || !code) return res.redirect(`${fe}/callback?error=oauth_denied`);

  if (!await consumeOAuthState(state)) {
    console.warn("[githubCallback] Invalid or expired state");
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

    const token = signToken(user.id);
    sendTokenCookie(res, token);
    return res.redirect(`${fe}/callback`);
  } catch (err) {
    console.error("[githubCallback]", err);
    return res.redirect(`${fe}/callback?error=oauth_failed`);
  }
};
