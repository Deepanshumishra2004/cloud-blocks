import Redis from "ioredis";
import { env, isDev, isTest } from "../config/env";
import { logger } from "./logger";

type RedisValue = string;
type SetArgs = [key: string, value: string, mode?: string, ttlSeconds?: number];
type ScanResult = [cursor: string, keys: string[]];

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(...args: SetArgs): Promise<"OK">;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  ping(): Promise<"PONG">;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  scan(cursor: string, ...args: Array<string | number>): Promise<ScanResult>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  quit(): Promise<"OK">;
  call(...args: string[]): Promise<unknown>;
};

const LOCAL_REDIS_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getRedisRetryDelay(attempt: number) {
  return Math.min(Math.max(attempt, 1) * 500, 5000);
}

function isLocalRedisUrl(url: string) {
  try {
    return LOCAL_REDIS_HOSTS.has(new URL(url).hostname);
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1") || url.includes("::1");
  }
}

function createMemoryRedis(): RedisLike {
  const values = new Map<string, RedisValue>();
  const expiries = new Map<string, number>();
  const sets = new Map<string, Set<string>>();

  const purgeExpired = (key: string) => {
    const expiresAt = expiries.get(key);
    if (!expiresAt || expiresAt > Date.now()) return;
    expiries.delete(key);
    values.delete(key);
    sets.delete(key);
  };

  const purgeAllExpired = () => {
    for (const key of expiries.keys()) purgeExpired(key);
  };

  return {
    async get(key) {
      purgeExpired(key);
      return values.get(key) ?? null;
    },
    async set(key, value, mode, ttlSeconds) {
      values.set(key, value);
      sets.delete(key);
      if (mode === "EX" && typeof ttlSeconds === "number") {
        expiries.set(key, Date.now() + ttlSeconds * 1000);
      } else {
        expiries.delete(key);
      }
      return "OK";
    },
    async del(...keys) {
      let removed = 0;
      for (const key of keys) {
        purgeExpired(key);
        const hadKey = values.delete(key) || sets.delete(key);
        expiries.delete(key);
        if (hadKey) removed += 1;
      }
      return removed;
    },
    async exists(key) {
      purgeExpired(key);
      return values.has(key) || sets.has(key) ? 1 : 0;
    },
    async ping() {
      return "PONG";
    },
    async sadd(key, ...members) {
      purgeExpired(key);
      const bucket = sets.get(key) ?? new Set<string>();
      sets.set(key, bucket);
      values.delete(key);
      expiries.delete(key);
      let added = 0;
      for (const member of members) {
        if (!bucket.has(member)) {
          bucket.add(member);
          added += 1;
        }
      }
      return added;
    },
    async srem(key, ...members) {
      purgeExpired(key);
      const bucket = sets.get(key);
      if (!bucket) return 0;
      let removed = 0;
      for (const member of members) {
        if (bucket.delete(member)) removed += 1;
      }
      if (bucket.size === 0) sets.delete(key);
      return removed;
    },
    async smembers(key) {
      purgeExpired(key);
      return [...(sets.get(key) ?? [])];
    },
    async scan(cursor, ...args) {
      purgeAllExpired();
      let pattern = "*";
      for (let i = 0; i < args.length; i += 1) {
        if (String(args[i]).toUpperCase() === "MATCH") {
          pattern = String(args[i + 1] ?? "*");
          break;
        }
      }

      const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      const keys = [...new Set([...values.keys(), ...sets.keys()])].filter((key) => regex.test(key));
      return [cursor === "0" ? "0" : "0", keys];
    },
    async mget(...keys) {
      return Promise.all(keys.map((key) => this.get(key)));
    },
    async quit() {
      return "OK";
    },
    async call(...args) {
      throw new Error(`Memory redis does not support raw call(${args[0] ?? ""})`);
    },
  };
}

const useMemoryRedis = isTest || (isDev && isLocalRedisUrl(env.REDIS_URL));

function createNetworkRedis(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = getRedisRetryDelay(times);
      logger.warn({ attempt: times, delay }, "redis reconnect scheduled");
      return delay;
    },
    lazyConnect: true,
  });

  client.on("connect", () => logger.info("redis connected"));
  client.on("error", (err) => logger.error({ err }, "redis error"));

  return client;
}

export const redis: RedisLike = useMemoryRedis ? createMemoryRedis() : createNetworkRedis();

if (useMemoryRedis) {
  logger.info({ redisUrl: env.REDIS_URL }, "using in-memory redis fallback for local development");
}
