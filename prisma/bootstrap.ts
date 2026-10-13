/**
 * Per-organization bootstrap for CLOTHIFY.
 *
 * Creates the reference data every tenant depends on — the permission
 * catalogue, the system roles and their grants, and the subscription plans the
 * app prices against. Idempotent: it upserts and only adds the grants a role is
 * missing, so it is safe to run on every start.
 *
 * This is deliberately *not* `prisma/seed.ts`. The seed is a development
 * fixture that recreates the demo store (users, catalog, sales) on one published
 * password; this file only tops up the rows a real org's own actions assume
 * already exist. Demo users, catalog and tenants are never created here.
 *
 * Run: npx tsx prisma/bootstrap.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import {
  PERMISSION_CATALOG,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from "../src/core/rbac/catalog";
import { SUBSCRIPTION_PLANS } from "../src/core/plans";

function resolveSchema(url: string): string | undefined {
  if (process.env.DATABASE_SCHEMA) return process.env.DATABASE_SCHEMA;
  try {
    return new URL(url).searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
}

const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL is not set");

const schema = resolveSchema(url) ?? "public";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }, { schema }),
});

async function main(): Promise<void> {
  for (const permission of PERMISSION_CATALOG) {
    await db.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        module: permission.module,
        action: permission.action,
        descriptionAr: permission.descriptionAr,
        descriptionEn: permission.descriptionEn,
      },
      update: {
        module: permission.module,
        action: permission.action,
        descriptionAr: permission.descriptionAr,
        descriptionEn: permission.descriptionEn,
      },
    });
  }

  const permissionIdByCode = new Map(
    (await db.permission.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]),
  );

  const roleIdByCode = new Map<string, string>();
  for (const code of ROLE_CODES) {
    const names = ROLE_NAMES[code];
    const role = await db.role.upsert({
      where: { code },
      create: {
        code,
        nameAr: names.ar,
        nameEn: names.en,
        description: `System role: ${names.en}`,
        isSystem: true,
      },
      update: { nameAr: names.ar, nameEn: names.en },
    });
    roleIdByCode.set(code, role.id);
  }

  for (const code of ROLE_CODES) {
    const roleId = roleIdByCode.get(code);
    if (!roleId) continue;

    const held = new Set(
      (await db.rolePermission.findMany({ where: { roleId }, select: { permissionId: true } })).map(
        (rp) => rp.permissionId,
      ),
    );
    const missing = ROLE_PERMISSIONS[code]
      .map((permission) => permissionIdByCode.get(permission))
      .filter((id): id is string => Boolean(id) && !held.has(id as string))
      .map((permissionId) => ({ roleId, permissionId }));

    if (missing.length > 0) {
      await db.rolePermission.createMany({ data: missing, skipDuplicates: true });
    }
  }

  for (const plan of SUBSCRIPTION_PLANS) {
    await db.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        priceMonthly: plan.priceMonthly,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        productLimit: plan.productLimit,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        priceMonthly: plan.priceMonthly,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        productLimit: plan.productLimit,
        sortOrder: plan.sortOrder,
      },
    });
  }

  console.log(
    `[bootstrap] schema=${schema} permissions=${permissionIdByCode.size} roles=${roleIdByCode.size} plans=${SUBSCRIPTION_PLANS.length} ok`,
  );
}

main()
  .catch((err) => {
    console.error("[bootstrap] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
