import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/format";

export const REPORT_KEYS = [
  "dailySales",
  "salesByProduct",
  "salesByVariant",
  "salesByCategory",
  "salesByBranch",
  "bestSellers",
  "slowMovers",
  "grossProfit",
  "expenses",
  "inventoryValuation",
  "lowStock",
  "returns",
  "paymentMethods",
  "customerPurchases",
  "purchasing",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export type Column = {
  key: string;
  labelKey: string;
  align?: "start" | "end";
  kind?: "text" | "money" | "int";
};

export type Row = Record<string, string | number>;

export type ReportResult = {
  columns: Column[];
  rows: Row[];
  summary?: { labelKey: string; value: number; kind: "money" | "int" }[];
};

type Args = {
  tenantId: string;
  report: ReportKey;
  from: Date;
  to: Date;
  branchId?: string;
  branchIds: string[];
  locale: string;
  t: (key: string) => string;
};

function branchWhere(branchId: string | undefined, branchIds: string[]) {
  if (branchId) return { branchId };
  if (branchIds.length) return { branchId: { in: branchIds } };
  return {};
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function runReport(args: Args): Promise<ReportResult> {
  const { tenantId, report, from, to, branchId, branchIds, locale, t } = args;
  const bf = branchWhere(branchId, branchIds);
  const range = { gte: from, lt: to };
  const ar = locale === "ar";

  switch (report) {
    case "dailySales": {
      const sales = await prisma.sale.findMany({
        where: { tenantId, ...bf, status: "COMPLETED", saleDate: range },
        select: { saleDate: true, total: true },
      });
      const map = new Map<string, { orders: number; revenue: number }>();
      for (const s of sales) {
        const k = dayKey(s.saleDate);
        const cur = map.get(k) ?? { orders: 0, revenue: 0 };
        cur.orders += 1;
        cur.revenue += toNumber(s.total);
        map.set(k, cur);
      }
      return {
        columns: [
          { key: "date", labelKey: "reports.dateRange" },
          { key: "orders", labelKey: "reports.count", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: [...map.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([date, v]) => ({ date, orders: v.orders, revenue: v.revenue })),
      };
    }

    case "salesByProduct":
    case "bestSellers": {
      const items = await prisma.saleItem.findMany({
        where: { sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
        select: { productId: true, productNameEn: true, productNameAr: true, quantity: true, unitCost: true, total: true },
      });
      const map = new Map<string, { name: string; units: number; revenue: number; cogs: number }>();
      for (const it of items) {
        const cur = map.get(it.productId) ?? { name: ar ? it.productNameAr : it.productNameEn, units: 0, revenue: 0, cogs: 0 };
        cur.units += it.quantity;
        cur.revenue += toNumber(it.total);
        cur.cogs += it.quantity * toNumber(it.unitCost);
        map.set(it.productId, cur);
      }
      const all = [...map.values()];
      const rows =
        report === "bestSellers"
          ? all.sort((a, b) => b.units - a.units).slice(0, 20)
          : all.sort((a, b) => b.revenue - a.revenue);
      return {
        columns: [
          { key: "name", labelKey: "products.title" },
          { key: "units", labelKey: "reports.unitsSold", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
          { key: "cogs", labelKey: "reports.cogs", align: "end", kind: "money" },
        ],
        rows,
      };
    }

    case "salesByVariant": {
      const items = await prisma.saleItem.findMany({
        where: { sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
        select: { variantId: true, variantLabel: true, productNameEn: true, productNameAr: true, quantity: true, total: true, unitCost: true },
      });
      const map = new Map<string, { name: string; units: number; revenue: number; cogs: number }>();
      for (const it of items) {
        const key = it.variantId ?? `${it.productNameEn}-none`;
        const label = `${ar ? it.productNameAr : it.productNameEn}${it.variantLabel ? ` · ${it.variantLabel}` : ""}`;
        const cur = map.get(key) ?? { name: label, units: 0, revenue: 0, cogs: 0 };
        cur.units += it.quantity;
        cur.revenue += toNumber(it.total);
        cur.cogs += it.quantity * toNumber(it.unitCost);
        map.set(key, cur);
      }
      return {
        columns: [
          { key: "name", labelKey: "products.title" },
          { key: "units", labelKey: "reports.unitsSold", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.revenue - a.revenue),
      };
    }

    case "salesByCategory": {
      const items = await prisma.saleItem.findMany({
        where: { sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
        select: {
          quantity: true,
          total: true,
          product: { select: { category: { select: { id: true, nameEn: true, nameAr: true } } } },
        },
      });
      const map = new Map<string, { name: string; units: number; revenue: number }>();
      for (const it of items) {
        const cat = it.product.category;
        const key = cat?.id ?? "none";
        const name = cat ? (ar ? cat.nameAr : cat.nameEn) : "—";
        const cur = map.get(key) ?? { name, units: 0, revenue: 0 };
        cur.units += it.quantity;
        cur.revenue += toNumber(it.total);
        map.set(key, cur);
      }
      return {
        columns: [
          { key: "name", labelKey: "reports.salesByCategory" },
          { key: "units", labelKey: "reports.unitsSold", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.revenue - a.revenue),
      };
    }

    case "salesByBranch": {
      const grouped = await prisma.sale.groupBy({
        by: ["branchId"],
        where: { tenantId, ...bf, status: "COMPLETED", saleDate: range },
        _sum: { total: true },
        _count: { _all: true },
      });
      const branches = await prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, nameEn: true, nameAr: true },
      });
      const nameMap = new Map(branches.map((b) => [b.id, ar ? b.nameAr : b.nameEn]));
      return {
        columns: [
          { key: "name", labelKey: "reports.salesByBranch" },
          { key: "orders", labelKey: "reports.count", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: grouped
          .map((g) => ({
            name: nameMap.get(g.branchId) ?? g.branchId,
            orders: g._count._all,
            revenue: toNumber(g._sum.total ?? 0),
          }))
          .sort((a, b) => b.revenue - a.revenue),
      };
    }

    case "slowMovers": {
      const [products, items] = await Promise.all([
        prisma.product.findMany({
          where: { tenantId, status: "ACTIVE" },
          select: { id: true, nameEn: true, nameAr: true },
        }),
        prisma.saleItem.groupBy({
          by: ["productId"],
          where: { sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
          _sum: { quantity: true },
        }),
      ]);
      const soldMap = new Map(items.map((i) => [i.productId, i._sum.quantity ?? 0]));
      const rows = products
        .map((p) => ({
          name: ar ? p.nameAr : p.nameEn,
          units: soldMap.get(p.id) ?? 0,
        }))
        .sort((a, b) => a.units - b.units)
        .slice(0, 30);
      return {
        columns: [
          { key: "name", labelKey: "products.title" },
          { key: "units", labelKey: "reports.unitsSold", align: "end", kind: "int" },
        ],
        rows,
      };
    }

    case "grossProfit": {
      const [salesAgg, items, expensesAgg] = await Promise.all([
        prisma.sale.aggregate({
          where: { tenantId, ...bf, status: "COMPLETED", saleDate: range },
          _sum: { total: true },
        }),
        prisma.saleItem.findMany({
          where: { sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
          select: { quantity: true, unitCost: true },
        }),
        prisma.expense.aggregate({
          where: { tenantId, ...bf, expenseDate: range },
          _sum: { amount: true },
        }),
      ]);
      const revenue = toNumber(salesAgg._sum.total ?? 0);
      const cogs = items.reduce((s, i) => s + i.quantity * toNumber(i.unitCost), 0);
      const gross = revenue - cogs;
      const exp = toNumber(expensesAgg._sum.amount ?? 0);
      const net = gross - exp;
      return {
        columns: [
          { key: "metric", labelKey: "reports.chooseReport" },
          { key: "amount", labelKey: "common.total", align: "end", kind: "money" },
        ],
        rows: [
          { metric: t("reports.revenue"), amount: revenue },
          { metric: t("reports.cogs"), amount: cogs },
          { metric: t("reports.grossProfitLabel"), amount: gross },
          { metric: t("reports.expenses"), amount: exp },
          { metric: t("reports.netProfit"), amount: net },
        ],
        summary: [{ labelKey: "reports.margin", value: revenue > 0 ? (gross / revenue) * 100 : 0, kind: "int" }],
      };
    }

    case "expenses": {
      const grouped = await prisma.expense.groupBy({
        by: ["categoryId"],
        where: { tenantId, ...bf, expenseDate: range },
        _sum: { amount: true },
        _count: { _all: true },
      });
      const cats = await prisma.expenseCategory.findMany({
        where: { tenantId },
        select: { id: true, nameEn: true, nameAr: true },
      });
      const nameMap = new Map(cats.map((c) => [c.id, ar ? c.nameAr : c.nameEn]));
      return {
        columns: [
          { key: "name", labelKey: "expenses.category" },
          { key: "count", labelKey: "reports.count", align: "end", kind: "int" },
          { key: "amount", labelKey: "expenses.amount", align: "end", kind: "money" },
        ],
        rows: grouped
          .map((g) => ({
            name: g.categoryId ? (nameMap.get(g.categoryId) ?? "—") : "—",
            count: g._count._all,
            amount: toNumber(g._sum.amount ?? 0),
          }))
          .sort((a, b) => b.amount - a.amount),
      };
    }

    case "inventoryValuation": {
      const balances = await prisma.inventoryBalance.findMany({
        where: { tenantId, ...bf, quantity: { gt: 0 } },
        select: { branchId: true, quantity: true, variant: { select: { cost: true, price: true } } },
      });
      const branches = await prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, nameEn: true, nameAr: true },
      });
      const nameMap = new Map(branches.map((b) => [b.id, ar ? b.nameAr : b.nameEn]));
      const map = new Map<string, { cost: number; retail: number; units: number }>();
      for (const b of balances) {
        const cur = map.get(b.branchId) ?? { cost: 0, retail: 0, units: 0 };
        cur.cost += b.quantity * toNumber(b.variant.cost);
        cur.retail += b.quantity * toNumber(b.variant.price);
        cur.units += b.quantity;
        map.set(b.branchId, cur);
      }
      return {
        columns: [
          { key: "name", labelKey: "branches.title" },
          { key: "units", labelKey: "reports.unitsSold", align: "end", kind: "int" },
          { key: "cost", labelKey: "reports.cogs", align: "end", kind: "money" },
          { key: "retail", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: [...map.entries()].map(([id, v]) => ({
          name: nameMap.get(id) ?? id,
          units: v.units,
          cost: v.cost,
          retail: v.retail,
        })),
      };
    }

    case "lowStock": {
      const threshold = Number(
        ((await prisma.tenant.findUnique({ where: { id: tenantId }, select: { config: true } }))?.config as { lowStockThreshold?: number } | null)
          ?.lowStockThreshold ?? 5,
      );
      const balances = await prisma.inventoryBalance.findMany({
        where: { tenantId, ...bf },
        select: {
          quantity: true,
          variant: { select: { sku: true, optionEn: true, product: { select: { nameEn: true, nameAr: true } } } },
        },
      });
      const map = new Map<string, { name: string; sku: string; stock: number }>();
      for (const b of balances) {
        const key = b.variant.sku;
        const cur = map.get(key) ?? {
          name: `${ar ? b.variant.product.nameAr : b.variant.product.nameEn}${b.variant.optionEn ? ` · ${b.variant.optionEn}` : ""}`,
          sku: b.variant.sku,
          stock: 0,
        };
        cur.stock += b.quantity;
        map.set(key, cur);
      }
      return {
        columns: [
          { key: "name", labelKey: "products.title" },
          { key: "sku", labelKey: "products.sku" },
          { key: "stock", labelKey: "inventory.balance", align: "end", kind: "int" },
        ],
        rows: [...map.values()].filter((v) => v.stock <= threshold).sort((a, b) => a.stock - b.stock),
        summary: [{ labelKey: "settings.lowStockThreshold", value: threshold, kind: "int" }],
      };
    }

    case "returns": {
      const refunds = await prisma.refund.findMany({
        where: { tenantId, ...bf, status: "COMPLETED", refundDate: range },
        select: { refundNo: true, refundDate: true, amount: true, reason: true },
        orderBy: { refundDate: "desc" },
      });
      return {
        columns: [
          { key: "refundNo", labelKey: "sales.refund" },
          { key: "date", labelKey: "common.date" },
          { key: "reason", labelKey: "sales.refundReason" },
          { key: "amount", labelKey: "common.amount", align: "end", kind: "money" },
        ],
        rows: refunds.map((r) => ({
          refundNo: r.refundNo,
          date: r.refundDate.toISOString().slice(0, 10),
          reason: r.reason ?? "—",
          amount: toNumber(r.amount),
        })),
      };
    }

    case "paymentMethods": {
      const grouped = await prisma.payment.groupBy({
        by: ["method"],
        where: { refundId: null, sale: { tenantId, ...bf, status: "COMPLETED", saleDate: range } },
        _sum: { amount: true },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: "method", labelKey: "reports.method" },
          { key: "count", labelKey: "reports.count", align: "end", kind: "int" },
          { key: "amount", labelKey: "common.amount", align: "end", kind: "money" },
        ],
        rows: grouped
          .map((g) => ({ method: g.method, count: g._count._all, amount: toNumber(g._sum.amount ?? 0) }))
          .sort((a, b) => b.amount - a.amount),
      };
    }

    case "customerPurchases": {
      const grouped = await prisma.sale.groupBy({
        by: ["customerId"],
        where: { tenantId, ...bf, status: "COMPLETED", saleDate: range, customerId: { not: null } },
        _sum: { total: true },
        _count: { _all: true },
      });
      const ids = grouped.map((g) => g.customerId).filter((x): x is string => Boolean(x));
      const customers = await prisma.customer.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, nameAr: true },
      });
      const nameMap = new Map(customers.map((c) => [c.id, ar ? (c.nameAr ?? c.name) : c.name]));
      return {
        columns: [
          { key: "name", labelKey: "customers.title" },
          { key: "orders", labelKey: "reports.count", align: "end", kind: "int" },
          { key: "revenue", labelKey: "reports.revenue", align: "end", kind: "money" },
        ],
        rows: grouped
          .filter((g) => g.customerId)
          .map((g) => ({
            name: nameMap.get(g.customerId as string) ?? "—",
            orders: g._count._all,
            revenue: toNumber(g._sum.total ?? 0),
          }))
          .sort((a, b) => b.revenue - a.revenue),
      };
    }

    case "purchasing": {
      const pos = await prisma.purchaseOrder.findMany({
        where: { tenantId, ...bf, createdAt: range },
        include: { supplier: { select: { name: true, nameAr: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        columns: [
          { key: "poNo", labelKey: "purchasing.poNumber" },
          { key: "supplier", labelKey: "purchasing.supplier" },
          { key: "date", labelKey: "common.date" },
          { key: "status", labelKey: "common.status" },
          { key: "total", labelKey: "common.total", align: "end", kind: "money" },
        ],
        rows: pos.map((p) => ({
          poNo: p.poNo,
          supplier: ar ? (p.supplier.nameAr ?? p.supplier.name) : p.supplier.name,
          date: p.createdAt.toISOString().slice(0, 10),
          status: p.status,
          total: toNumber(p.total),
        })),
      };
    }
  }
}
