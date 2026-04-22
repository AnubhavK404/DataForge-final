import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// PrismaClient is expensive; keep a singleton in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    if (!databaseUrl) {
      if (process.env.NODE_ENV === "production") {
        // During build/collect-data phase, don't throw immediately. 
        // Only return a proxy that throws on access, or a dummy client if we must.
        // Actually, let's just warn and throw a clearer error on first call.
        console.warn("DATABASE_URL is missing. Prisma will fail on first query.");
      }
      // Return a proxy that throws when any property is accessed
      return new Proxy({} as PrismaClient, {
        get() {
          throw new Error("PrismaClient failed to initialize: DATABASE_URL is missing in environment variables.");
        }
      });
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool as any);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
