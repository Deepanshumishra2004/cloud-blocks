// src/lib/passwordReset.ts
//
// Password-reset tokens. Stored in Redis hashed (sha256) so a Redis dump
// cannot be used to reset accounts. TTL: 15 minutes. One-shot consume.

import crypto from "crypto";
import { redis } from "./redis";

export const RESET_TTL_SECS = 15 * 60;

const KEY = (hash: string) => `pwr:${hash}`;

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await redis.set(KEY(hash(raw)), userId, "EX", RESET_TTL_SECS);
  return raw;
}

// Atomically validate and consume — returns userId if valid, null otherwise.
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const key = KEY(hash(token));
  const userId = await (redis as any).getdel?.(key);
  if (userId !== undefined && userId !== null) return userId;
  const value = await redis.get(key);
  if (!value) return null;
  await redis.del(key);
  return value;
}
