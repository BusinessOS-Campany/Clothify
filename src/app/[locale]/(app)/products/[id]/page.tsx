import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { toNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";
import {
  VariantManager,
  type VariantRow,
} from "@/components/products/variant-manager";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Shirt } from "lucide-react";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("products");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("products:write");
  const { id } = await params;

  const [product, categories, brands, suppliers] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        variants: {
          include: {
            balances: {
              where: ctx.branchIds.length ? { branchId: { in: ctx.branchIds } } : {},
              select: { quantity: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.category.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.brand.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.supplier.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true, nameAr: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  const variants: VariantRow[] = product.variants.map((v) => {
    const attrs = (v.attributes ?? {}) as { color?: string; size?: string };
    return {
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      color: attrs.color ?? null,
      size: attrs.size ?? null,
      price: String(toNumber(v.price)),
      cost: String(toNumber(v.cost)),
      isActive: v.isActive,
      stock: v.balances.reduce((s, b) => s + b.quantity, 0),
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={locale === "ar" ? product.nameAr : product.nameEn}
        description={product.sku}
        icon={Shirt}
        actions={<DeleteProductButton id={product.id} />}
      />
      <ProductForm
        product={{
          id: product.id,
          nameEn: product.nameEn,
          nameAr: product.nameAr,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.categoryId,
          brandId: product.brandId,
          supplierId: product.supplierId,
          cost: String(toNumber(product.cost)),
          price: String(toNumber(product.price)),
          compareAtPrice: product.compareAtPrice
            ? String(toNumber(product.compareAtPrice))
            : "",
          gender: product.gender,
          season: product.season,
          material: product.material,
          descriptionEn: product.descriptionEn,
          descriptionAr: product.descriptionAr,
          status: product.status,
          isActive: product.isActive,
        }}
        categories={categories}
        brands={brands}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          nameEn: s.name,
          nameAr: s.nameAr,
        }))}
      />
      <VariantManager productId={product.id} variants={variants} />
      <p className="pb-4 text-xs text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}
