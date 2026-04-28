import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env, isProd } from "../config/env";

declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter, // required in Prisma 7+
  });

if (!isProd) {
  global.prisma = prisma;
}