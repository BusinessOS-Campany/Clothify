import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { TransferBuilder } from "@/components/inventory/transfer-builder";
import { ArrowLeftRight } from "lucide-react";

export default async function NewTransferPage() {
  const t = await getTranslations("inventory");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:transfer");

  const [branches, variants] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.productVariant.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: {
        id: true,
        sku: true,
        optionEn: true,
        product: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { sku: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("createTransfer")} description={t("transferItemsHint")} icon={ArrowLeftRight} />
      <TransferBuilder
        branches={branches}
        variants={variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          label:
            (locale === "ar" ? v.product.nameAr : v.product.nameEn) +
            (v.optionEn ? ` · ${v.optionEn}` : ""),
        }))}
      />
    </div>
  );
}
