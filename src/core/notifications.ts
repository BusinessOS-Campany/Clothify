import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { getStoreConfig } from "@/lib/store-config";
import { branchFilter } from "@/core/tenant";
import type { AppNotification, BranchOption } from "@/components/layout/types";

/** Builds the header notification list from real operational signals. */
export async function getNotifications(locale: string): Promise<AppNotification[]> {
  const ctx = await requireTenantContext();
  const config = await getStoreConfig(ctx.tenantId);
  const bf = branchFilter(ctx);
  const out: AppNotification[] = [];
  const isAr = locale === "ar";

  const lowStock = await prisma.inventoryBalance.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...bf,
      quantity: { lte: config.lowStockThreshold },
      variant: { isActive: true },
    },
    take: 5,
    orderBy: { quantity: "asc" },
    include: {
      variant: {
        select: {
          optionEn: true,
          product: { select: { nameEn: true, nameAr: true } },
        },
      },
    },
  });

  for (const row of lowStock) {
    const name = isAr ? row.variant.product.nameAr : row.variant.product.nameEn;
    out.push({
      id: `low-${row.id}`,
      tone: row.quantity <= 0 ? "danger" : "warning",
      text: isAr
        ? `مخزون منخفض: ${name} (${row.quantity})`
        : `Low stock: ${name} (${row.quantity})`,
      href: "/inventory",
    });
  }

  const pendingPo = await prisma.purchaseOrder.count({
    where: { tenantId: ctx.tenantId, status: { in: ["ORDERED", "PARTIAL"] } },
  });
  if (pendingPo > 0) {
    out.push({
      id: "pending-po",
      tone: "default",
      text: isAr
        ? `${pendingPo} أمر شراء بانتظار الاستلام`
        : `${pendingPo} purchase order(s) awaiting receipt`,
      href: "/purchasing",
    });
  }

  return out;
}

export async function getBranchOptions(): Promise<BranchOption[]> {
  const ctx = await requireTenantContext();
  const branches = await prisma.branch.findMany({
    where: {
      tenantId: ctx.tenantId,
      isActive: true,
      ...(ctx.branchIds.length > 0 ? { id: { in: ctx.branchIds } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, nameAr: true, nameEn: true },
  });
  return branches;
}