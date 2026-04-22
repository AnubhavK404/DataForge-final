<<<<<<< HEAD
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// PrismaClient is expensive; keep a singleton in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // Fail fast with a clear message (NextAuth/prisma will otherwise throw cryptic engine errors).
  throw new Error("Missing DATABASE_URL in your environment.");
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool = new Pool({ connectionString: databaseUrl });
    // @ts-expect-error - Prisma adapter uses a vendored pg type that conflicts with the standard @types/pg
    const adapter = new PrismaPg(pool as any);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

