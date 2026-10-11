import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext, branchFilter } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { getStoreConfig } from "@/lib/store-config";
import { inventoryValue } from "@/lib/inventory";
import { fmtMoney, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, Search, Warehouse } from "lucide-react";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branchId?: string; low?: string }>;
}) {
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");
  const config = await getStoreConfig(ctx.tenantId);

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const branchId = sp.branchId && ctx.branchIds.length === 0
    ? sp.branchId
    : sp.branchId && ctx.branchIds.includes(sp.branchId)
      ? sp.branchId
      : undefined;
  const lowOnly = sp.low === "1";

  const [branches, valuation] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    inventoryValue(ctx.tenantId, ctx.branchIds.length ? ctx.branchIds : undefined),
  ]);

  const balances = await prisma.inventoryBalance.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...branchFilter(ctx),
      ...(branchId ? { branchId } : {}),
      ...(q
        ? {
            variant: {
              OR: [
                { sku: { contains: q, mode: "insensitive" } },
                { product: { nameEn: { contains: q, mode: "insensitive" } } },
                { product: { nameAr: { contains: q } } },
              ],
            },
          }
        : {}),
    },
    include: {
      branch: { select: { nameAr: true, nameEn: true } },
      variant: {
        select: {
          sku: true,
          optionEn: true,
          cost: true,
          price: true,
          product: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
    orderBy: [{ quantity: "asc" }],
    take: 200,
  });

  const rows = balances.filter((b) => (lowOnly ? b.quantity <= config.lowStockThreshold : true));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} icon={Warehouse} />

      <InventoryTabs />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("valueAtCost")}</p>
              <p className="text-lg font-semibold" dir="ltr">
                {fmtMoney(valuation.costValue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("valueAtRetail")}</p>
              <p className="text-lg font-semibold" dir="ltr">
                {fmtMoney(valuation.retailValue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/inventory">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchStock")} className="ps-9" />
        </div>
        <select
          name="branchId"
          defaultValue={branchId ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">{t("allBranches")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {locale === "ar" ? b.nameAr : b.nameEn}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-4 rounded border-input" />
          {t("lowStock")}
        </label>
        <Button type="submit" variant="secondary">
          {tc("filter")}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("variant")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead className="text-end">{t("balance")}</TableHead>
                <TableHead className="text-end">{t("valueAtCost")}</TableHead>
                <TableHead className="text-end">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const label = [
                  locale === "ar" ? b.variant.product.nameAr : b.variant.product.nameEn,
                  b.variant.optionEn,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const qty = b.quantity;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span className="font-medium">{label}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{b.variant.sku}</TableCell>
                    <TableCell>{locale === "ar" ? b.branch.nameAr : b.branch.nameEn}</TableCell>
                    <TableCell className="text-end">
                      <span
                        className={
                          qty <= 0
                            ? "font-semibold text-destructive"
                            : qty <= config.lowStockThreshold
                              ? "font-semibold text-warning"
                              : "font-medium"
                        }
                        dir="ltr"
                      >
                        {fmtInt(qty)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground" dir="ltr">
                      {fmtMoney(qty * b.variant.cost.toNumber())}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        {qty <= 0 ? (
                          <Badge variant="outline" className="text-destructive">
                            {t("outOfStock")}
                          </Badge>
                        ) : qty <= config.lowStockThreshold ? (
                          <Badge variant="outline" className="text-warning">
                            {t("lowStock")}
                          </Badge>
                        ) : null}
                        <AdjustStockDialog
                          branchId={b.branchId}
                          variantId={b.variantId}
                          label={label}
                          currentQty={qty}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
