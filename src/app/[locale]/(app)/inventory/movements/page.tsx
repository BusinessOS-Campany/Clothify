import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext, branchFilter } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Search } from "lucide-react";
import type { InventoryMovementType } from "@/lib/generated/prisma/client";

const TYPES: InventoryMovementType[] = [
  "INITIAL",
  "PURCHASE",
  "RECEIPT",
  "SALE",
  "REFUND",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT",
  "DAMAGE",
  "RETURN",
];

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branchId?: string; type?: string; page?: string }>;
}) {
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = TYPES.includes(sp.type as InventoryMovementType)
    ? (sp.type as InventoryMovementType)
    : undefined;
  const branchId = sp.branchId && (ctx.branchIds.length === 0 || ctx.branchIds.includes(sp.branchId))
    ? sp.branchId
    : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 50;

  const branches = await prisma.branch.findMany({
    where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
    select: { id: true, nameAr: true, nameEn: true },
    orderBy: { nameEn: "asc" },
  });

  const where = {
    tenantId: ctx.tenantId,
    ...branchFilter(ctx),
    ...(branchId ? { branchId } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          variant: {
            OR: [
              { sku: { contains: q, mode: "insensitive" as const } },
              { product: { nameEn: { contains: q, mode: "insensitive" as const } } },
              { product: { nameAr: { contains: q } } },
            ],
          },
        }
      : {}),
  };

  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        branch: { select: { nameAr: true, nameEn: true } },
        variant: {
          select: { sku: true, optionEn: true, product: { select: { nameAr: true, nameEn: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const pages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("movements")} description={t("subtitle")} icon={ArrowLeftRight} />

      <InventoryTabs />

      <form className="flex flex-wrap items-center gap-2" action="/inventory/movements">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchStock")} className="ps-9" />
        </div>
        <select name="type" defaultValue={type ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{t("moveType")}</option>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
        <select name="branchId" defaultValue={branchId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{t("allBranches")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {locale === "ar" ? b.nameAr : b.nameEn}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          {tc("filter")}
        </Button>
      </form>

      {movements.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead>{t("moveType")}</TableHead>
                <TableHead className="text-end">{t("delta")}</TableHead>
                <TableHead className="text-end">{t("balanceAfter")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => {
                const label =
                  (locale === "ar" ? m.variant.product.nameAr : m.variant.product.nameEn) +
                  (m.variant.optionEn ? ` · ${m.variant.optionEn}` : "");
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(m.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{label}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{m.variant.sku}</span>
                    </TableCell>
                    <TableCell>{locale === "ar" ? m.branch.nameAr : m.branch.nameEn}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-semibold" dir="ltr">
                      <span className={m.quantity >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {m.quantity >= 0 ? "+" : ""}
                        {fmtInt(m.quantity)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end" dir="ltr">
                      {fmtInt(m.balanceAfter)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.reference ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tc("page")} {page} {tc("of")} {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <a href={`/inventory/movements?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(branchId ? { branchId } : {}), page: String(page - 1) }).toString()}`}>
                  {tc("previous")}
                </a>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <a href={`/inventory/movements?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(branchId ? { branchId } : {}), page: String(page + 1) }).toString()}`}>
                  {tc("next")}
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
