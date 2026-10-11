import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { branchFilter } from "@/core/tenant";
import { getStoreConfig } from "@/lib/store-config";
import { inventoryValue } from "@/lib/inventory";
import { fmtMoney, toNumber, fmtInt } from "@/lib/format";
import { addDays, startOfMonth, toISODate } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import {
  ShoppingCart,
  Warehouse,
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Receipt,
  Percent,
  Plus,
  ScanLine,
} from "lucide-react";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("pos");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  const config = await getStoreConfig(ctx.tenantId);
  const bf = branchFilter(ctx);

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const monthStart = startOfMonth(now);
  const trendStart = addDays(todayStart, -13);

  const saleScope = { tenantId: ctx.tenantId, ...bf, status: { not: "CANCELLED" as const } };

  const [
    salesTodayAgg,
    salesMonthAgg,
    ordersMonth,
    monthItems,
    refundsMonthAgg,
    expensesMonthAgg,
    lowStockCount,
    customersCount,
    trendRows,
    paymentGroups,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...saleScope, saleDate: { gte: todayStart } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...saleScope, saleDate: { gte: monthStart } },
      _sum: { total: true, taxAmount: true },
      _count: true,
    }),
    prisma.sale.count({ where: { ...saleScope, saleDate: { gte: monthStart } } }),
    prisma.saleItem.findMany({
      where: {
        sale: { tenantId: ctx.tenantId, ...bf, saleDate: { gte: monthStart }, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } },
      },
      select: {
        quantity: true,
        unitCost: true,
        total: true,
        productId: true,
        product: {
          select: {
            nameAr: true,
            nameEn: true,
            category: { select: { nameAr: true, nameEn: true } },
          },
        },
      },
    }),
    prisma.refund.aggregate({
      where: { tenantId: ctx.tenantId, status: "COMPLETED", refundDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId: ctx.tenantId, ...bf, expenseDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.inventoryBalance.count({
      where: { tenantId: ctx.tenantId, ...bf, quantity: { lte: config.lowStockThreshold }, variant: { isActive: true } },
    }),
    prisma.customer.count({ where: { tenantId: ctx.tenantId, isActive: true } }),
    prisma.sale.findMany({
      where: { tenantId: ctx.tenantId, ...bf, saleDate: { gte: trendStart }, status: { not: "CANCELLED" } },
      select: { saleDate: true, total: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { sale: { tenantId: ctx.tenantId, ...bf, saleDate: { gte: monthStart }, status: { not: "CANCELLED" } } },
      _sum: { amount: true },
    }),
  ]);

  const salesToday = toNumber(salesTodayAgg._sum.total);
  const salesMonth = toNumber(salesMonthAgg._sum.total);
  const taxMonth = toNumber(salesMonthAgg._sum.taxAmount);
  const refundsMonth = toNumber(refundsMonthAgg._sum.amount);
  const expensesMonth = toNumber(expensesMonthAgg._sum.amount);

  let grossProfit = 0;
  let unitsSold = 0;
  const bestMap = new Map<string, { label: string; count: number }>();
  const catMap = new Map<string, number>();
  for (const it of monthItems) {
    grossProfit += toNumber(it.total) - toNumber(it.unitCost) * it.quantity;
    unitsSold += it.quantity;
    const name = locale === "ar" ? it.product.nameAr : it.product.nameEn;
    const b = bestMap.get(it.productId) ?? { label: name, count: 0 };
    b.count += it.quantity;
    bestMap.set(it.productId, b);
    const cat = it.product.category
      ? locale === "ar"
        ? it.product.category.nameAr
        : it.product.category.nameEn
      : locale === "ar"
        ? "أخرى"
        : "Other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + toNumber(it.total));
  }
  grossProfit = Math.round(grossProfit * 100) / 100;

  const netProfit = Math.round((grossProfit - expensesMonth - refundsMonth) * 100) / 100;
  const avgOrder = ordersMonth > 0 ? salesMonth / ordersMonth : 0;

  const inv = await inventoryValue(ctx.tenantId, ctx.branchIds.length ? ctx.branchIds : undefined);

  // Sales trend (last 14 days)
  const byDay = new Map<string, number>();
  for (const r of trendRows) {
    const key = toISODate(new Date(r.saleDate));
    byDay.set(key, (byDay.get(key) ?? 0) + toNumber(r.total));
  }
  const dayLabel = (d: Date) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
      day: "numeric",
      month: "short",
    }).format(d);
  const salesTrend = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(trendStart, i);
    return {
      label: dayLabel(d),
      value: Math.round((byDay.get(toISODate(d)) ?? 0) * 100) / 100,
    };
  });

  const bestSellers = [...bestMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((b) => ({ label: b.label.length > 22 ? `${b.label.slice(0, 20)}…` : b.label, count: b.count }));

  const categoryMix = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));

  const paymentLabels: Record<string, string> = {
    CASH: tp("cash"),
    CARD: tp("card"),
    MOBILE_WALLET: tp("mobileWallet"),
    BANK_TRANSFER: tp("bankTransfer"),
    OTHER: tp("other"),
  };
  const paymentMix = paymentGroups
    .map((p) => ({
      label: paymentLabels[p.method] ?? p.method,
      value: Math.round(toNumber(p._sum.amount) * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  const kpis: {
    label: string;
    value: string;
    icon: typeof ShoppingCart;
    tone?: "default" | "warning" | "danger";
  }[] = [
    { label: t("kpiSalesToday"), value: fmtMoney(salesToday), icon: ShoppingCart },
    { label: t("kpiSalesMonth"), value: fmtMoney(salesMonth), icon: TrendingUp },
    { label: t("kpiGrossProfit"), value: fmtMoney(grossProfit), icon: TrendingUp },
    { label: t("kpiExpenses"), value: fmtMoney(expensesMonth), icon: Wallet },
    { label: t("kpiNetProfit"), value: fmtMoney(netProfit), icon: netProfit >= 0 ? TrendingUp : TrendingDown },
    { label: t("kpiOrders"), value: fmtInt(ordersMonth), icon: Receipt },
    { label: t("kpiAvgOrder"), value: fmtMoney(avgOrder), icon: Percent },
    { label: t("kpiInventoryValue"), value: fmtMoney(inv.costValue), icon: Warehouse },
    { label: t("kpiLowStock"), value: fmtInt(lowStockCount), icon: AlertTriangle, tone: lowStockCount > 0 ? "warning" : "default" },
    { label: t("kpiCustomers"), value: fmtInt(customersCount), icon: Users },
  ];

  const quick = [
    { label: t("newSale"), href: "/pos", icon: ScanLine },
    { label: t("addProduct"), href: "/products/new", icon: Plus },
    { label: t("viewReports"), href: "/reports", icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          store: locale === "ar" ? ctx.tenantNameAr : ctx.tenantNameEn,
        })}
        actions={
          <Button asChild size="sm">
            <Link href="/pos">
              <ScanLine />
              {t("newSale")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-start justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 truncate text-xl font-semibold" dir="ltr">
                    {k.value}
                  </p>
                </div>
                <div
                  className={
                    k.tone === "warning"
                      ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"
                      : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  }
                >
                  <Icon className="size-4" aria-hidden />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {quick.map((q) => {
          const Icon = q.icon;
          return (
            <Button key={q.label} asChild variant="outline" size="sm">
              <Link href={q.href}>
                <Icon />
                {q.label}
              </Link>
            </Button>
          );
        })}
        <span className="ms-auto self-center text-xs text-muted-foreground">
          {t("insufficientData") === ""
            ? null
            : `${fmtInt(unitsSold)} ${t("units")}`}
        </span>
      </div>

      <DashboardCharts
        salesTrend={salesTrend}
        bestSellers={bestSellers}
        categoryMix={categoryMix}
        paymentMix={paymentMix}
      />

      {taxMonth > 0 && (
        <p className="text-xs text-muted-foreground">
          {config.taxNameEn}: {fmtMoney(taxMonth)}
        </p>
      )}
    </div>
  );
}
