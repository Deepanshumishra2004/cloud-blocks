import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";  // 📌 new

declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!, 
});

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,             // ❗ required in Prisma 7+
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}