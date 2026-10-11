import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Shirt } from "lucide-react";

export default async function NewProductPage() {
  const t = await getTranslations("products");
  const ctx = await requireTenantContext();
  await requirePermission("products:write");

  const [categories, brands, suppliers] = await Promise.all([
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={t("new")} description={t("subtitle")} icon={Shirt} />
      <ProductForm
        categories={categories}
        brands={brands}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          nameEn: s.name,
          nameAr: s.nameAr,
        }))}
      />
    </div>
  );
}
