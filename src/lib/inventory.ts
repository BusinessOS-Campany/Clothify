import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { InventoryMovementType } from "@/lib/generated/prisma/client";

export class InventoryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type AdjustStockOpts = {
  tenantId: string;
  branchId: string;
  variantId: string;
  type: InventoryMovementType;
  /** signed: + in / − out */
  quantity: number;
  unitCost?: number;
  reference?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
  allowNegative?: boolean;
};

/**
 * Adjusts stock for a variant at a branch inside the caller's transaction.
 *
 * Decrements use an atomic conditional UPDATE (`UPDATE ... SET qty = qty − n
 * WHERE qty >= n`) so two concurrent sales can never oversell the same SKU:
 * only one transaction can consume the last unit. Returns the new balance.
 */
export async function adjustStock(
  tx: Prisma.TransactionClient,
  opts: AdjustStockOpts,
): Promise<number> {
  const { tenantId, branchId, variantId, quantity } = opts;
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new InventoryError("Quantity must be a non-zero integer", "BAD_QTY");
  }

  if (quantity < 0) {
    const need = -quantity;
    const res = await tx.inventoryBalance.updateMany({
      where: { branchId, variantId, quantity: { gte: need } },
      data: { quantity: { decrement: need } },
    });
    if (res.count === 0) {
      const bal = await tx.inventoryBalance.findUnique({
        where: { branchId_variantId: { branchId, variantId } },
      });
      if (opts.allowNegative) {
        await tx.inventoryBalance.upsert({
          where: { branchId_variantId: { branchId, variantId } },
          create: {
            tenantId,
            branchId,
            variantId,
            quantity: quantity,
          },
          update: { quantity: { decrement: need } },
        });
      } else {
        throw new InventoryError(
          `Insufficient stock (${bal?.quantity ?? 0} available, ${need} needed)`,
          "INSUFFICIENT_STOCK",
        );
      }
    }
  } else {
    await tx.inventoryBalance.upsert({
      where: { branchId_variantId: { branchId, variantId } },
      create: { tenantId, branchId, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });
    // Read the post-image.
    const fresh = await tx.inventoryBalance.findUniqueOrThrow({
      where: { branchId_variantId: { branchId, variantId } },
    });
    const after = fresh.quantity;
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        branchId,
        variantId,
        type: opts.type,
        quantity,
        balanceAfter: after,
        unitCost: opts.unitCost,
        reference: opts.reference,
        referenceId: opts.referenceId,
        notes: opts.notes,
        createdBy: opts.createdBy,
      },
    });
    return after;
  }

  const fresh = await tx.inventoryBalance.findUniqueOrThrow({
    where: { branchId_variantId: { branchId, variantId } },
  });
  await tx.inventoryMovement.create({
    data: {
      tenantId,
      branchId,
      variantId,
      type: opts.type,
      quantity,
      balanceAfter: fresh.quantity,
      unitCost: opts.unitCost,
      reference: opts.reference,
      referenceId: opts.referenceId,
      notes: opts.notes,
      createdBy: opts.createdBy,
    },
  });
  return fresh.quantity;
}

export function getVariantBalance(
  tx: Pick<Prisma.TransactionClient, "inventoryBalance">,
  branchId: string,
  variantId: string,
) {
  return tx.inventoryBalance.findUnique({
    where: { branchId_variantId: { branchId, variantId } },
  });
}

/** Sum a variant's stock across all branches the user can see. */
export async function totalVariantStock(
  tenantId: string,
  variantId: string,
  branchIds?: string[],
): Promise<number> {
  const where = { variantId, ...(branchIds ? { branchId: { in: branchIds } } : {}) };
  const agg = await prisma.inventoryBalance.aggregate({
    where,
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export async function inventoryValue(
  tenantId: string,
  branchIds?: string[],
): Promise<{ costValue: number; retailValue: number }> {
  const rows = await prisma.inventoryBalance.findMany({
    where: { tenantId, ...(branchIds ? { branchId: { in: branchIds } } : {}) },
    select: {
      quantity: true,
      variant: { select: { cost: true, price: true } },
    },
  });
  let costValue = 0;
  let retailValue = 0;
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    costValue += r.quantity * r.variant.cost.toNumber();
    retailValue += r.quantity * r.variant.price.toNumber();
  }
  return {
    costValue: Math.round(costValue * 100) / 100,
    retailValue: Math.round(retailValue * 100) / 100,
  };
}

/**
 * Inventory valuation using FIFO-ish average unit cost from movements history
 * is intentionally not mixed into this count: valuation is cost-basis on the
 * ledger snapshot. See reports module for the cost-of-goods figures.
 */