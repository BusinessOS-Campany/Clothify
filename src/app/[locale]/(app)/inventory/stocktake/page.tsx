import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { createStocktake } from "@/app/[locale]/(app)/inventory/actions";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { StatusBadge } from "@/components/inventory/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList } from "lucide-react";

export default async function StocktakePage() {
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");

  const [branches, stocktakes] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.stocktake.findMany({
      where: { tenantId: ctx.tenantId },
      include: { branch: { select: { nameAr: true, nameEn: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("stocktake")} description={t("subtitle")} icon={ClipboardList} />

      <InventoryTabs />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("newStocktake")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStocktake} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-56 flex-col gap-1.5">
              <label htmlFor="branchId" className="text-xs text-muted-foreground">
                {t("branch")}
              </label>
              <select
                id="branchId"
                name="branchId"
                required
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {locale === "ar" ? b.nameAr : b.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">{t("newStocktake")}</Button>
          </form>
        </CardContent>
      </Card>

      {stocktakes.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("stocktakeNo")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead>{t("items")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("transferStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocktakes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/inventory/stocktake/${s.id}`} className="font-mono text-xs font-medium hover:text-primary hover:underline">
                      {s.stocktakeNo}
                    </Link>
                  </TableCell>
                  <TableCell>{locale === "ar" ? s.branch.nameAr : s.branch.nameEn}</TableCell>
                  <TableCell dir="ltr">{s._count.items}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(s.createdAt, locale)}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
