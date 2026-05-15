// src/lib/token.ts
//
// JWT issuance + verification. Two token families:
//
//   access  — short-lived (15m), sent on every API call via cookie or Bearer.
//   refresh — longer-lived (7d), sent only to /refresh on its own scoped cookie.
//
// Every token carries a `jti` (UUID) so it can be revoked individually via the
// Redis blacklist (see lib/tokenBlacklist.ts). Tokens also carry a `type`
// claim — access tokens cannot be exchanged where refresh is required and
// vice-versa, even though they share signing infrastructure.
//
// Refresh tokens are additionally tracked server-side: when issued, we record
// `rt:<jti>` in Redis. Rotation deletes the old entry. If a refresh token is
// presented whose jti is no longer in Redis we treat it as theft — see
// consumeRefreshToken().

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { redis } from "./redis";

export const ACCESS_TTL_SECS  = 15 * 60;           // 15 minutes
export const REFRESH_TTL_SECS = 7 * 24 * 60 * 60;  // 7 days
export const SESSION_TTL_SECS = 5 * 60;            // 5 min — for WS handshake tokens

const ACCESS_SECRET  = env.JWT_SECRET;
// Derive a distinct secret for refresh tokens so a leaked access token cannot
// be replayed as a refresh token (defence in depth even though token.type
// gates this at the verify layer).
const REFRESH_SECRET =
  env.REFRESH_TOKEN_SECRET ??
  crypto.createHash("sha256").update(`${env.JWT_SECRET}:refresh:v1`).digest("hex");

export type TokenType = "access" | "refresh" | "session";

export interface TokenPayload {
  userId: string;
  jti: string;
  type: TokenType;
  iat: number;
  exp: number;
}

interface IssuedToken {
  token: string;
  jti: string;
  expiresAt: number; // unix seconds
}

function sign(payload: { userId: string; type: TokenType }, secret: string, ttlSecs: number): IssuedToken {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSecs;
  const token = jwt.sign(
    { userId: payload.userId, type: payload.type, jti },
    secret,
    { expiresIn: ttlSecs, jwtid: jti },
  );
  return { token, jti, expiresAt: exp };
}

export function signAccessToken(userId: string): IssuedToken {
  return sign({ userId, type: "access" }, ACCESS_SECRET, ACCESS_TTL_SECS);
}

export function signRefreshToken(userId: string): IssuedToken {
  return sign({ userId, type: "refresh" }, REFRESH_SECRET, REFRESH_TTL_SECS);
}

// Short-lived single-purpose token for WebSocket handshake. Verified by the
// ws-server which doesn't share Redis with the API — so this token cannot
// be revoked early, just kept short.
export function signSessionToken(userId: string): IssuedToken {
  return sign({ userId, type: "session" }, ACCESS_SECRET, SESSION_TTL_SECS);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
  if (decoded.type !== "access" && decoded.type !== "session") {
    throw new Error("Wrong token type");
  }
  return decoded;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Wrong token type");
  }
  return decoded;
}

/* ──── Refresh token tracking (server-side state) ───────────────────────── */

const REFRESH_KEY = (jti: string) => `rt:${jti}`;

// Track an issued refresh token so we can detect reuse / explicit revocation.
export async function trackRefreshToken(jti: string, userId: string, ttlSecs = REFRESH_TTL_SECS): Promise<void> {
  await redis.set(REFRESH_KEY(jti), userId, "EX", ttlSecs);
}

// One-shot consume: returns the userId if the jti was tracked and was
// atomically deleted. Returns null otherwise (already-used or never-issued).
// Callers MUST treat null as a theft signal and revoke the whole session.
export async function consumeRefreshToken(jti: string): Promise<string | null> {
  // GETDEL is atomic — no race between read and delete.
  const userId = await (redis as any).getdel?.(REFRESH_KEY(jti));
  if (userId !== undefined) return userId;
  // Fallback for older Redis: pipeline get+del.
  const value = await redis.get(REFRESH_KEY(jti));
  if (!value) return null;
  await redis.del(REFRESH_KEY(jti));
  return value;
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  await redis.del(REFRESH_KEY(jti));
}

// Revoke every refresh token tied to a user (called on password change /
// "log out everywhere"). SCAN is used to avoid blocking Redis with KEYS.
export async function revokeAllRefreshTokensForUser(userId: string): Promise<number> {
  let cursor = "0";
  let removed = 0;
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", "rt:*", "COUNT", 200);
    cursor = next;
    if (batch.length === 0) continue;
    const values = await redis.mget(...batch);
    const toDelete = batch.filter((_, i) => values[i] === userId);
    if (toDelete.length) {
      removed += await redis.del(...toDelete);
    }
  } while (cursor !== "0");
  return removed;
}
