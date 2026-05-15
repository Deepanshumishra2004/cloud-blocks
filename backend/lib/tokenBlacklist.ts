// src/lib/tokenBlacklist.ts
//
// Server-side JWT revocation. Each token carries a `jti` claim — to revoke
// a token we add `bl:<jti>` to Redis with a TTL equal to the remaining
// lifetime of the token. Every authMiddleware request checks for this key.
//
// Why not check the user-level blacklist with the database? Latency. A Redis
// GET is sub-ms; a Postgres roundtrip on every request would dominate the
// auth path.

import { redis } from "./redis";

const KEY = (jti: string) => `bl:${jti}`;

export async function blacklistJti(jti: string, ttlSecs: number): Promise<void> {
  if (ttlSecs <= 0) return; // already expired — no point storing
  await redis.set(KEY(jti), "1", "EX", ttlSecs);
}

export async function isBlacklisted(jti: string): Promise<boolean> {
  return (await redis.exists(KEY(jti))) === 1;
}
