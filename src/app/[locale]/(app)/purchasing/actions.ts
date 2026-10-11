"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { getStoreConfigFresh } from "@/lib/store-config";
import { adjustStock, InventoryError } from "@/lib/inventory";
import { nextNumber } from "@/lib/sequence";
import { recordAudit } from "@/core/audit";
import { toNumber } from "@/lib/format";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const poSchema = z.object({
  branchId: z.string().min(1),
  supplierId: z.string().min(1),
  expectedDeliveryDate: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  items: z.string().min(2),
});

export async function createPurchaseOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:write");

  const parsed = poSchema.safeParse({
    branchId: formData.get("branchId"),
    supplierId: formData.get("supplierId"),
    expectedDeliveryDate: formData.get("expectedDeliveryDate"),
    notes: formData.get("notes"),
    items: formData.get("items"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  let lines: { variantId: string; quantity: number; unitCost: number }[];
  try {
    lines = JSON.parse(d.items);
  } catch {
    return { error: "invalid" };
  }
  lines = lines.filter((l) => l.variantId && l.quantity > 0);
  if (lines.length === 0) return { error: "empty" };

  const config = await getStoreConfigFresh(ctx.tenantId);
  const variants = await prisma.productVariant.findMany({
    where: { tenantId: ctx.tenantId, id: { in: lines.map((l) => l.variantId) } },
    select: { id: true, cost: true },
  });
  const vmap = new Map(variants.map((v) => [v.id, v]));
  if (variants.length !== lines.length) return { error: "invalid" };

  const itemData = lines.map((l) => {
    const v = vmap.get(l.variantId)!;
    const unitCost = l.unitCost > 0 ? l.unitCost : toNumber(v.cost);
    return {
      variantId: l.variantId,
      quantity: l.quantity,
      unitCost,
      lineTotal: r2(unitCost * l.quantity),
    };
  });
  const subtotal = r2(itemData.reduce((s, i) => s + i.lineTotal, 0));
  const taxRate = config.taxEnabled ? config.taxRate : 0;
  const taxAmount = r2((subtotal * taxRate) / 100);
  const total = r2(subtotal + taxAmount);

  const poNo = await nextNumber(ctx.tenantId, "PO");
  const created = await prisma.purchaseOrder.create({
    data: {
      tenantId: ctx.tenantId,
      branchId: d.branchId,
      supplierId: d.supplierId,
      poNo,
      status: "ORDERED",
      subtotal,
      taxRate,
      taxAmount,
      total,
      expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate) : null,
      notes: d.notes ?? null,
      createdBy: ctx.userId,
      items: { create: itemData },
    },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "PurchaseOrder", entityId: created.id, metadata: { poNo } });
  revalidatePath("/purchasing");
  redirect({ href: `/purchasing/${created.id}`, locale: await getLocale() });
}

export async function markOrdered(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.purchaseOrder.updateMany({
    where: { id, tenantId: ctx.tenantId, status: "DRAFT" },
    data: { status: "ORDERED" },
  });
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
}

export async function cancelPurchaseOrder(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.purchaseOrder.updateMany({
    where: { id, tenantId: ctx.tenantId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
    data: { status: "CANCELLED" },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "cancel", entity: "PurchaseOrder", entityId: id });
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
}

const receiveSchema = z.object({
  poId: z.string().min(1),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  items: z.string().min(2),
});

export async function receiveGoods(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:receive");

  const parsed = receiveSchema.safeParse({
    poId: formData.get("poId"),
    notes: formData.get("notes"),
    items: formData.get("items"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  let rawItems: { poItemId: string; quantity: number }[];
  try {
    rawItems = JSON.parse(d.items);
  } catch {
    return { error: "invalid" };
  }
  rawItems = rawItems.filter((i) => i.quantity > 0);
  if (rawItems.length === 0) return { error: "empty" };

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: d.poId, tenantId: ctx.tenantId },
    include: { items: true },
  });
  if (!po) return { error: "notFound" };
  if (po.status === "CANCELLED" || po.status === "RECEIVED") return { error: "invalid" };

  const itemMap = new Map(po.items.map((i) => [i.id, i]));
  for (const it of rawItems) {
    const pi = itemMap.get(it.poItemId);
    if (!pi) return { error: "invalid" };
    if (it.quantity > pi.quantity - pi.receivedQuantity) return { error: "invalid" };
  }

  const receiptNo = await nextNumber(ctx.tenantId, "GOODS");
  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: po.branchId,
          poId: po.id,
          receiptNo,
          receivedBy: ctx.userId,
          notes: d.notes ?? null,
          items: {
            create: rawItems.map((it) => ({
              variantId: itemMap.get(it.poItemId)!.variantId,
              quantity: it.quantity,
              unitCost: toNumber(itemMap.get(it.poItemId)!.unitCost),
            })),
          },
        },
      });

      for (const it of rawItems) {
        const pi = itemMap.get(it.poItemId)!;
        await adjustStock(tx, {
          tenantId: ctx.tenantId,
          branchId: po.branchId,
          variantId: pi.variantId,
          type: "PURCHASE",
          quantity: it.quantity,
          unitCost: toNumber(pi.unitCost),
          reference: receiptNo,
          referenceId: receipt.id,
          createdBy: ctx.userId,
        });
        await tx.purchaseOrderItem.update({
          where: { id: pi.id },
          data: { receivedQuantity: { increment: it.quantity } },
        });
      }

      const fresh = await tx.purchaseOrderItem.findMany({ where: { poId: po.id } });
      const allReceived = fresh.every((i) => i.receivedQuantity >= i.quantity);
      const anyReceived = fresh.some((i) => i.receivedQuantity > 0);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status },
      });
    });
  } catch (err) {
    if (err instanceof InventoryError) return { error: "invalid" };
    throw err;
  }

  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "receive", entity: "PurchaseOrder", entityId: po.id, metadata: { receiptNo } });
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${po.id}`);
  return { ok: true };
}
