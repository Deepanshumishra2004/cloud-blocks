import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env, isProd } from "../config/env";
import { logger } from "./logger";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // pg 8.22+ treats `sslmode=require` in the URL as `verify-full`, which fails
    // cert-chain/hostname verification against the Neon pooler inside the alpine
    // container and surfaces as P1001 DatabaseNotReachable. The connection is
    // still TLS-encrypted; we just skip strict chain verification (managed PG).
    ssl: { rejectUnauthorized: false },
  });

  return new PrismaClient({
    adapter, // required in Prisma 7+
  });
}

function isDatabaseReachabilityError(error: unknown) {
  const err = error as {
    code?: string;
    meta?: {
      driverAdapterError?: {
        cause?: {
          kind?: string;
        };
      };
    };
  };

  return err?.code === "P1001" ||
    (err?.code === "P2010" && err?.meta?.driverAdapterError?.cause?.kind === "DatabaseNotReachable") ||
    err?.meta?.driverAdapterError?.cause?.kind === "DatabaseNotReachable";
}

export let prisma = global.prisma || createPrismaClient();

if (!isProd) {
  global.prisma = prisma;
}

export async function refreshPrismaClient() {
  await prisma.$disconnect().catch(() => {});
  prisma = createPrismaClient();
  if (!isProd) {
    global.prisma = prisma;
  }
  return prisma;
}

export async function withPrismaRetry<T>(operation: (db: PrismaClient) => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation(prisma);
    } catch (error) {
      lastError = error;
      // Only reachability errors are recoverable by reconnecting — anything else
      // (validation, constraint, etc.) is a real failure; surface it immediately.
      if (!isDatabaseReachabilityError(error)) throw error;
      if (i === attempts - 1) break;

      // A cold/unreachable DB at boot can wedge the pooled client; a single retry
      // isn't enough. Recreate the client and back off so it self-heals once the
      // database is reachable again, instead of needing a manual restart.
      logger.warn({ err: error, attempt: i + 1 }, "prisma lost database reachability; recreating client and retrying");
      await refreshPrismaClient();
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastError;
}
