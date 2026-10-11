import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import {
  saveStocktakeCounts,
  applyStocktake,
} from "@/app/[locale]/(app)/inventory/actions";
import { fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("inventory");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");
  const { id } = await params;

  const stocktake = await prisma.stocktake.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      branch: { select: { nameAr: true, nameEn: true } },
      items: {
        include: {
          variant: {
            select: { sku: true, optionEn: true, product: { select: { nameAr: true, nameEn: true } } },
          },
        },
        orderBy: { variant: { sku: "asc" } },
      },
    },
  });
  if (!stocktake) notFound();

  const editable = stocktake.status === "DRAFT" || stocktake.status === "IN_PROGRESS";
  const totalDiff = stocktake.items.reduce((s, i) => s + (i.difference ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t("stocktakeNo")} ${stocktake.stocktakeNo}`}
        description={locale === "ar" ? stocktake.branch.nameAr : stocktake.branch.nameEn}
        icon={ClipboardList}
        actions={<StatusBadge status={stocktake.status} />}
      />

      <InventoryTabs />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("items")}</p>
            <p className="font-medium" dir="ltr">{stocktake.items.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("variance")}</p>
            <p className={cn("font-medium", totalDiff !== 0 && "text-warning")} dir="ltr">
              {totalDiff >= 0 ? "+" : ""}
              {fmtInt(totalDiff)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("transferStatus")}</p>
            <StatusBadge status={stocktake.status} />
          </div>
        </CardContent>
      </Card>

      <form action={saveStocktakeCounts} className="overflow-hidden rounded-xl border bg-card">
        <input type="hidden" name="id" value={stocktake.id} />
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-start text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("product")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("variant")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("expected")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("counted")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("difference")}</th>
              </tr>
            </thead>
            <tbody>
              {stocktake.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    {locale === "ar" ? item.variant.product.nameAr : item.variant.product.nameEn}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{item.variant.sku}</td>
                  <td className="px-4 py-2 text-end" dir="ltr">{fmtInt(item.expectedQty)}</td>
                  <td className="px-4 py-2 text-end">
                    {editable ? (
                      <Input
                        name={`count_${item.id}`}
                        type="number"
                        defaultValue={item.countedQty ?? item.expectedQty}
                        dir="ltr"
                        className="ms-auto h-8 w-24"
                      />
                    ) : (
                      <span dir="ltr">{fmtInt(item.countedQty ?? 0)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-end" dir="ltr">
                    <span className={cn((item.difference ?? 0) !== 0 && "font-semibold text-warning")}>
                      {(item.difference ?? 0) > 0 ? "+" : ""}
                      {fmtInt(item.difference ?? 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="submit" variant="secondary">
              {t("saveCounts")}
            </Button>
          </div>
        )}
      </form>

      {editable && (
        <form action={applyStocktake} className="flex justify-end">
          <input type="hidden" name="id" value={stocktake.id} />
          <Button type="submit">{t("applyCounts")}</Button>
        </form>
      )}
    </div>
  );
}
