"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/core/auth/session";

const createStoreSchema = z.object({
  nameEn: z.string().trim().min(2),
  nameAr: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "slug"),
  currency: z.string().trim().min(1).max(8),
  currencySymbol: z.string().trim().min(1).max(4),
  locale: z.enum(["ar", "en"]),
  planCode: z.enum(["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

export type CreateStoreState = { error?: string } | undefined;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createStore(
  _prev: CreateStoreState,
  formData: FormData,
): Promise<CreateStoreState> {
  const user = await requireUser();
  const parsed = createStoreSchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    slug: formData.get("slug"),
    currency: formData.get("currency"),
    currencySymbol: formData.get("currencySymbol"),
    locale: formData.get("locale"),
    planCode: formData.get("planCode"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const data = parsed.data;
  const slug = data.slug || slugify(data.nameEn);

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return { error: "slugTaken" };

  const ownerRole = await prisma.role.findUnique({ where: { code: "owner" } });
  if (!ownerRole) {
    return { error: "rolesMissing" };
  }
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: data.planCode },
  });
  const trialPlan =
    plan ??
    (await prisma.subscriptionPlan.findUnique({ where: { code: "TRIAL" } }));
  if (!trialPlan) return { error: "planMissing" };

  const tenantCode = `STORE-${slug.toUpperCase().slice(0, 8)}`;

  const tenantId = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        code: tenantCode,
        slug,
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        locale: data.locale,
        config: {
          taxEnabled: false,
          taxRate: 0,
          allowNegativeInventory: false,
          lowStockThreshold: 5,
          discountEnabled: true,
          maxDiscountPercent: 100,
        },
      },
    });

    await tx.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
      },
    });

    await tx.branch.create({
      data: {
        tenantId: tenant.id,
        code: "MAIN",
        nameEn: "Main Branch",
        nameAr: "الفرع الرئيسي",
        isActive: true,
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: trialPlan.id,
        status: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        development: true,
      },
    });

    const categories = [
      { nameEn: "Rent", nameAr: "الإيجار", color: "#6366f1" },
      { nameEn: "Salaries", nameAr: "الرواتب", color: "#0ea5e9" },
      { nameEn: "Utilities", nameAr: "المرافق", color: "#14b8a6" },
      { nameEn: "Marketing", nameAr: "التسويق", color: "#f59e0b" },
      { nameEn: "Other", nameAr: "أخرى", color: "#64748b" },
    ];
    await tx.expenseCategory.createMany({
      data: categories.map((c) => ({
        tenantId: tenant.id,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        color: c.color,
        isSystem: true,
      })),
    });

    await tx.user.update({
      where: { id: user.id },
      data: { currentTenantId: tenant.id },
    });

    return tenant.id;
  });

  if (!tenantId) return { error: "unknown" };

  redirect({ href: "/", locale: await getLocale() });
}

export async function selectTenant(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tenantId = String(formData.get("tenantId") ?? "");
  const member = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.id } },
  });
  if (!member) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { currentTenantId: tenantId },
  });
  redirect({ href: "/", locale: await getLocale() });
}