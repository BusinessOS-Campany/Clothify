import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { toNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseOrderBuilder } from "@/components/purchasing/purchase-order-builder";
import { ClipboardList } from "lucide-react";

export default async function NewPurchaseOrderPage() {
  const t = await getTranslations("purchasing");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:write");

  const [branches, suppliers, variants] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.supplier.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.productVariant.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, sku: true, optionEn: true, cost: true, product: { select: { nameAr: true, nameEn: true } } },
      orderBy: { sku: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={t("newPo")} description={t("subtitle")} icon={ClipboardList} />
      <PurchaseOrderBuilder
        branches={branches}
        suppliers={suppliers}
        variants={variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          label: (locale === "ar" ? v.product.nameAr : v.product.nameEn) + (v.optionEn ? ` · ${v.optionEn}` : ""),
          cost: toNumber(v.cost),
        }))}
      />
    </div>
  );
}
