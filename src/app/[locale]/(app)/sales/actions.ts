"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { adjustStock, InventoryError } from "@/lib/inventory";
import { nextNumber } from "@/lib/sequence";
import { recordAudit } from "@/core/audit";
import { toNumber } from "@/lib/format";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export async function processRefund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("sales:refund");

  const schema = z.object({
    saleId: z.string().min(1),
    reason: z.preprocess(emptyToUndef, z.string().trim().optional()),
    items: z.string().min(2),
  });
  const parsed = schema.safeParse({
    saleId: formData.get("saleId"),
    reason: formData.get("reason"),
    items: formData.get("items"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  let rawItems: { saleItemId: string; quantity: number; condition: string }[];
  try {
    rawItems = JSON.parse(d.items);
  } catch {
    return { error: "invalid" };
  }
  rawItems = rawItems.filter((i) => i.quantity > 0);
  if (rawItems.length === 0) return { error: "empty" };

  const sale = await prisma.sale.findFirst({
    where: { id: d.saleId, tenantId: ctx.tenantId },
    include: { items: true },
  });
  if (!sale) return { error: "notFound" };
  if (sale.status === "CANCELLED" || sale.status === "REFUNDED") return { error: "invalid" };

  const itemMap = new Map(sale.items.map((i) => [i.id, i]));
  for (const it of rawItems) {
    const si = itemMap.get(it.saleItemId);
    if (!si) return { error: "invalid" };
    if (it.quantity > si.quantity - si.returnedQty) return { error: "alreadyReturned" };
  }

  const refundNo = await nextNumber(ctx.tenantId, "REFUND");
  const taxRate = toNumber(sale.taxRate);

  try {
    await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const itemRows = rawItems.map((it) => {
        const si = itemMap.get(it.saleItemId)!;
        const unitPrice = toNumber(si.unitPrice);
        const total = Math.round(unitPrice * it.quantity * 100) / 100;
        subtotal += total;
        const cond: "DAMAGED" | "RESELLABLE" =
          it.condition === "DAMAGED" ? "DAMAGED" : "RESELLABLE";
        return {
          saleItemId: si.id,
          productId: si.productId,
          variantId: si.variantId,
          quantity: it.quantity,
          unitPrice,
          total,
          condition: cond,
          restocked: cond === "RESELLABLE",
        };
      });
      const taxAdjustment = Math.round((subtotal * taxRate) / 100 * 100) / 100;
      const amount = Math.round((subtotal + taxAdjustment) * 100) / 100;

      const refund = await tx.refund.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: sale.branchId,
          saleId: sale.id,
          refundNo,
          amount,
          taxAdjustment,
          status: "COMPLETED",
          reason: d.reason ?? null,
          processedBy: ctx.userId,
        },
      });

      await tx.refundItem.createMany({
        data: itemRows.map((row) => ({ ...row, refundId: refund.id })),
      });

      await tx.payment.create({
        data: {
          saleId: sale.id,
          refundId: refund.id,
          method: "CASH",
          amount,
          receivedBy: ctx.userId,
        },
      });

      for (const row of itemRows) {
        await tx.saleItem.update({
          where: { id: row.saleItemId },
          data: { returnedQty: { increment: row.quantity } },
        });
        if (row.restocked && row.variantId) {
          await adjustStock(tx, {
            tenantId: ctx.tenantId,
            branchId: sale.branchId,
            variantId: row.variantId,
            type: "REFUND",
            quantity: row.quantity,
            unitCost: toNumber(itemMap.get(row.saleItemId)!.unitCost),
            reference: refundNo,
            referenceId: refund.id,
            createdBy: ctx.userId,
          });
        }
      }

      const fresh = await tx.saleItem.findMany({ where: { saleId: sale.id } });
      const allReturned = fresh.every((i) => i.returnedQty >= i.quantity);
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: allReturned ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });

      return refund.id;
    });
  } catch (err) {
    if (err instanceof InventoryError) return { error: "invalid" };
    throw err;
  }

  recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "refund",
    entity: "Sale",
    entityId: sale.id,
    metadata: { refundNo },
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${sale.id}`);
  redirect({ href: `/sales/${sale.id}`, locale: await getLocale() });
}

export async function cancelSale(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("sales:cancel");
  const saleId = String(formData.get("saleId") ?? "");
  if (!saleId) return;

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!sale || sale.status !== "COMPLETED") return;
    for (const item of sale.items) {
      if (item.variantId) {
        await adjustStock(tx, {
          tenantId: ctx.tenantId,
          branchId: sale.branchId,
          variantId: item.variantId,
          type: "RETURN",
          quantity: item.quantity,
          unitCost: toNumber(item.unitCost),
          reference: sale.saleNo,
          referenceId: sale.id,
          notes: "Sale cancelled",
          createdBy: ctx.userId,
        });
      }
    }
    await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELLED" } });
  });

  recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "cancel",
    entity: "Sale",
    entityId: saleId,
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
}
