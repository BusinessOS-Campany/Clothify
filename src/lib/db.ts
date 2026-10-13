import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function resolveSchema(url: string): string | undefined {
  if (process.env.DATABASE_SCHEMA) return process.env.DATABASE_SCHEMA;
  try {
    return new URL(url).searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
}

function createClient() {
  const url = process.env.DATABASE_URL ?? "";
  const adapter = new PrismaPg({ connectionString: url }, { schema: resolveSchema(url) });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}