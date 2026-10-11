import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { getStoreConfig } from "@/lib/store-config";
import { toNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { PosTerminal, type PosProduct } from "@/components/pos/pos-terminal";
import { ShoppingCart } from "lucide-react";

export default async function PosPage() {
  const t = await getTranslations("pos");
  const ctx = await requireTenantContext();
  await requirePermission("pos:read");
  const config = await getStoreConfig(ctx.tenantId);

  const [branches, categories, productsRaw, customers] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.category.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.product.findMany({
      where: { tenantId: ctx.tenantId, isActive: true, status: "ACTIVE" },
      include: {
        category: { select: { nameEn: true, nameAr: true } },
        variants: {
          where: { isActive: true },
          include: {
            balances: {
              where: ctx.branchIds.length ? { branchId: { in: ctx.branchIds } } : {},
              select: { branchId: true, quantity: true },
            },
          },
          orderBy: { sku: "asc" },
        },
      },
      orderBy: { nameEn: "asc" },
      take: 500,
    }),
    prisma.customer.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const products: PosProduct[] = productsRaw
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      categoryId: p.categoryId,
      categoryNameEn: p.category?.nameEn ?? null,
      categoryNameAr: p.category?.nameAr ?? null,
      variants: p.variants.map((v) => {
        const stockByBranch: Record<string, number> = {};
        for (const b of branches) stockByBranch[b.id] = 0;
        for (const bal of v.balances) stockByBranch[bal.branchId] = bal.quantity;
        return {
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          label: v.optionEn,
          price: toNumber(v.price),
          stockByBranch,
        };
      }),
    }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("subtitle")} icon={ShoppingCart} />
      <PosTerminal
        branches={branches}
        initialBranchId={branches[0]?.id ?? ""}
        products={products}
        categories={categories}
        customers={customers}
        currencySymbol={ctx.currencySymbol}
        taxEnabled={config.taxEnabled}
        taxRate={config.taxRate}
        taxName={ctx.locale === "ar" ? config.taxNameAr : config.taxNameEn}
        enableLoyalty={config.enableLoyalty}
        discountEnabled={config.discountEnabled}
        maxDiscountPercent={config.maxDiscountPercent}
        allowNegative={config.allowNegativeInventory}
      />
    </div>
  );
}
