import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext, branchFilter } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
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
import { Receipt, Search } from "lucide-react";
import type { SaleStatus } from "@/lib/generated/prisma/client";

const STATUSES: SaleStatus[] = ["COMPLETED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED"];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; branchId?: string; from?: string; to?: string; page?: string }>;
}) {
  const t = await getTranslations("sales");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("sales:read");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = STATUSES.includes(sp.status as SaleStatus) ? (sp.status as SaleStatus) : undefined;
  const branchId = sp.branchId && (ctx.branchIds.length === 0 || ctx.branchIds.includes(sp.branchId)) ? sp.branchId : undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(new Date(sp.to).getTime() + 24 * 3600 * 1000) : undefined;
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
    ...(status ? { status } : {}),
    ...(from || to ? { saleDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { saleNo: { contains: q, mode: "insensitive" as const } },
            { customer: { name: { contains: q, mode: "insensitive" as const } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [sales, total, agg] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true, nameAr: true } },
        cashier: { select: { name: true, nameAr: true } },
        branch: { select: { nameAr: true, nameEn: true } },
        _count: { select: { items: true } },
      },
      orderBy: { saleDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { total: true } }),
  ]);

  const pages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Receipt}
        actions={
          <div className="text-end">
            <p className="text-xs text-muted-foreground">{tc("total")}</p>
            <p className="text-lg font-semibold" dir="ltr">
              {fmtMoney(agg._sum.total ?? 0)} {ctx.currencySymbol}
            </p>
          </div>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/sales">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchSales")} className="ps-9" />
        </div>
        <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{tc("status")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="branchId" defaultValue={branchId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{tc("all")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {locale === "ar" ? b.nameAr : b.nameEn}
            </option>
          ))}
        </select>
        <Input type="date" name="from" defaultValue={sp.from ?? ""} className="w-40" dir="ltr" />
        <Input type="date" name="to" defaultValue={sp.to ?? ""} className="w-40" dir="ltr" />
        <Button type="submit" variant="secondary">
          {tc("filter")}
        </Button>
      </form>

      {sales.length === 0 ? (
        <EmptyState icon={Receipt} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orderNo")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("customer")}</TableHead>
                <TableHead>{t("cashier")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead className="text-end">{t("items")}</TableHead>
                <TableHead className="text-end">{tc("total")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/sales/${s.id}`} className="font-mono text-xs font-medium hover:text-primary hover:underline">
                      {s.saleNo}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDateTime(s.saleDate, locale)}
                  </TableCell>
                  <TableCell>
                    {s.customer ? (locale === "ar" ? (s.customer.nameAr ?? s.customer.name) : s.customer.name) : t("customer")}
                  </TableCell>
                  <TableCell className="text-sm">{locale === "ar" ? (s.cashier.nameAr ?? s.cashier.name) : s.cashier.name}</TableCell>
                  <TableCell className="text-sm">{locale === "ar" ? s.branch.nameAr : s.branch.nameEn}</TableCell>
                  <TableCell className="text-end" dir="ltr">{s._count.items}</TableCell>
                  <TableCell className="text-end font-medium" dir="ltr">{fmtMoney(s.total)}</TableCell>
                  <TableCell>
                    <SaleStatusBadge status={s.status} />
                  </TableCell>
                </TableRow>
              ))}
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
                <a href={`/sales?${new URLSearchParams({ page: String(page - 1) }).toString()}`}>{tc("previous")}</a>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <a href={`/sales?${new URLSearchParams({ page: String(page + 1) }).toString()}`}>{tc("next")}</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
