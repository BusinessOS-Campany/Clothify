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
import type { InventoryMovementType } from "@/lib/generated/prisma/client";

export type ActionState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string> }
  | undefined;

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const reasonType: Record<string, InventoryMovementType> = {
  adjust: "ADJUSTMENT",
  damage: "DAMAGE",
  return: "RETURN",
};

export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:write");

  const schema = z.object({
    branchId: z.string().min(1),
    variantId: z.string().min(1),
    delta: z.coerce.number().int().refine((n) => n !== 0),
    reason: z.enum(["adjust", "damage", "return"]),
    notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  });
  const parsed = schema.safeParse({
    branchId: formData.get("branchId"),
    variantId: formData.get("variantId"),
    delta: formData.get("delta"),
    reason: formData.get("reason"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  if (!ctx.branchIds.length || ctx.branchIds.includes(d.branchId)) {
    // allowed
  } else {
    return { error: "forbidden" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await adjustStock(tx, {
        tenantId: ctx.tenantId,
        branchId: d.branchId,
        variantId: d.variantId,
        type: reasonType[d.reason]!,
        quantity: d.delta,
        notes: d.notes ?? undefined,
        createdBy: ctx.userId,
      });
    });
  } catch (err) {
    if (err instanceof InventoryError) {
      return { error: err.code === "INSUFFICIENT_STOCK" ? "insufficient" : "invalid" };
    }
    throw err;
  }

  recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "adjust",
    entity: "InventoryBalance",
    entityId: d.variantId,
    metadata: { branchId: d.branchId, delta: d.delta, reason: d.reason },
  });
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  return { ok: true };
}

const transferSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  items: z.string().min(2),
});

type TransferItem = { variantId: string; quantity: number };

export async function createTransfer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:transfer");

  const parsed = transferSchema.safeParse({
    fromBranchId: formData.get("fromBranchId"),
    toBranchId: formData.get("toBranchId"),
    notes: formData.get("notes"),
    items: formData.get("items"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  if (d.fromBranchId === d.toBranchId) return { error: "sameBranch" };

  let items: TransferItem[];
  try {
    items = JSON.parse(d.items);
  } catch {
    return { error: "invalid" };
  }
  items = items.filter((i) => i.variantId && i.quantity > 0);
  if (items.length === 0) return { error: "noItems" };

  const transferNo = await nextNumber(ctx.tenantId, "TRANSFER");
  const created = await prisma.inventoryTransfer.create({
    data: {
      tenantId: ctx.tenantId,
      transferNo,
      fromBranchId: d.fromBranchId,
      toBranchId: d.toBranchId,
      status: "PENDING",
      transferredBy: ctx.userId,
      notes: d.notes ?? null,
      items: {
        create: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
    },
  });
  recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "transfer",
    entity: "InventoryTransfer",
    entityId: created.id,
    metadata: { transferNo },
  });
  revalidatePath("/inventory/transfers");
  redirect({ href: "/inventory/transfers", locale: await getLocale() });
}

export async function dispatchTransfer(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:transfer");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!transfer || transfer.status !== "PENDING") return;
    for (const item of transfer.items) {
      await adjustStock(tx, {
        tenantId: ctx.tenantId,
        branchId: transfer.fromBranchId,
        variantId: item.variantId,
        type: "TRANSFER_OUT",
        quantity: -item.quantity,
        reference: transfer.transferNo,
        referenceId: transfer.id,
        createdBy: ctx.userId,
      });
    }
    await tx.inventoryTransfer.update({
      where: { id: transfer.id },
      data: { status: "IN_TRANSIT" },
    });
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "transfer", entity: "InventoryTransfer", entityId: id, metadata: { dispatch: true } });
  revalidatePath("/inventory/transfers");
  revalidatePath(`/inventory/transfers/${id}`);
}

export async function receiveTransfer(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:transfer");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!transfer || transfer.status !== "IN_TRANSIT") return;
    for (const item of transfer.items) {
      await adjustStock(tx, {
        tenantId: ctx.tenantId,
        branchId: transfer.toBranchId,
        variantId: item.variantId,
        type: "TRANSFER_IN",
        quantity: item.quantity,
        reference: transfer.transferNo,
        referenceId: transfer.id,
        createdBy: ctx.userId,
      });
      await tx.inventoryTransferItem.update({
        where: { id: item.id },
        data: { receivedQuantity: item.quantity },
      });
    }
    await tx.inventoryTransfer.update({
      where: { id: transfer.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "transfer", entity: "InventoryTransfer", entityId: id, metadata: { received: true } });
  revalidatePath("/inventory/transfers");
  revalidatePath(`/inventory/transfers/${id}`);
}

export async function cancelTransfer(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:transfer");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const reason = String(formData.get("reason") ?? "") || null;

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!transfer || transfer.status === "COMPLETED" || transfer.status === "CANCELLED") return;
    // Return stock to source if it had been dispatched.
    if (transfer.status === "IN_TRANSIT") {
      for (const item of transfer.items) {
        await adjustStock(tx, {
          tenantId: ctx.tenantId,
          branchId: transfer.fromBranchId,
          variantId: item.variantId,
          type: "TRANSFER_IN",
          quantity: item.quantity,
          reference: transfer.transferNo,
          referenceId: transfer.id,
          notes: "Transfer cancelled",
          createdBy: ctx.userId,
        });
      }
    }
    await tx.inventoryTransfer.update({
      where: { id: transfer.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "cancel", entity: "InventoryTransfer", entityId: id });
  revalidatePath("/inventory/transfers");
  revalidatePath(`/inventory/transfers/${id}`);
}

export async function createStocktake(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:stocktake");
  const branchId = String(formData.get("branchId") ?? "");
  if (!branchId) return;

  const balances = await prisma.inventoryBalance.findMany({
    where: { tenantId: ctx.tenantId, branchId },
    select: { variantId: true, quantity: true },
  });
  const stocktakeNo = await nextNumber(ctx.tenantId, "STOCKTAKE");
  const created = await prisma.stocktake.create({
    data: {
      tenantId: ctx.tenantId,
      branchId,
      stocktakeNo,
      status: "IN_PROGRESS",
      countedBy: ctx.userId,
      items: {
        create: balances.map((b) => ({
          variantId: b.variantId,
          expectedQty: b.quantity,
          countedQty: b.quantity,
          difference: 0,
        })),
      },
    },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Stocktake", entityId: created.id });
  revalidatePath("/inventory/stocktake");
  redirect({ href: `/inventory/stocktake/${created.id}`, locale: await getLocale() });
}

export async function saveStocktakeCounts(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:stocktake");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const stocktake = await prisma.stocktake.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { items: true },
  });
  if (!stocktake || stocktake.status === "COMPLETED" || stocktake.status === "CANCELLED")
    return;
  for (const item of stocktake.items) {
    const raw = formData.get(`count_${item.id}`);
    if (raw == null || raw === "") continue;
    const counted = Math.trunc(Number(raw));
    if (!Number.isFinite(counted)) continue;
    await prisma.stocktakeItem.update({
      where: { id: item.id },
      data: { countedQty: counted, difference: counted - item.expectedQty },
    });
  }
  revalidatePath(`/inventory/stocktake/${id}`);
}

export async function applyStocktake(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("inventory:stocktake");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const stocktake = await tx.stocktake.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!stocktake || stocktake.status === "COMPLETED" || stocktake.status === "CANCELLED") return;
    for (const item of stocktake.items) {
      const counted = item.countedQty;
      if (counted == null) continue;
      const diff = counted - item.expectedQty;
      if (diff === 0) continue;
      await adjustStock(tx, {
        tenantId: ctx.tenantId,
        branchId: stocktake.branchId,
        variantId: item.variantId,
        type: "ADJUSTMENT",
        quantity: diff,
        reference: stocktake.stocktakeNo,
        referenceId: stocktake.id,
        notes: "Stocktake adjustment",
        createdBy: ctx.userId,
      });
    }
    await tx.stocktake.update({
      where: { id: stocktake.id },
      data: { status: "COMPLETED", countedAt: new Date() },
    });
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "adjust", entity: "Stocktake", entityId: id });
  revalidatePath("/inventory/stocktake");
  revalidatePath(`/inventory/stocktake/${id}`);
}
