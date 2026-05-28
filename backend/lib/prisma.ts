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

export async function withPrismaRetry<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
  try {
    return await operation(prisma);
  } catch (error) {
    if (!isDatabaseReachabilityError(error)) throw error;

    logger.warn({ err: error }, "prisma client lost database reachability; recreating client and retrying once");
    const nextClient = await refreshPrismaClient();
    return operation(nextClient);
  }
}
