import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Postgres swap (ADR 0001 portability rule): replace the adapter with
// @prisma/adapter-pg when DATABASE_URL starts with postgres://, change the
// datasource provider in prisma/schema.prisma, and regenerate migrations.
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  if (!url.startsWith("file:")) {
    throw new Error(
      "Only SQLite (file:) DATABASE_URL is wired up. For Postgres, swap the driver adapter in src/lib/prisma.ts.",
    );
  }
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
