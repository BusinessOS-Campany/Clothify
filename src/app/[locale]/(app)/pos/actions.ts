"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { computeTotals, discountAllowed } from "@/lib/pricing";
import { getStoreConfigFresh } from "@/lib/store-config";
import { adjustStock, InventoryError } from "@/lib/inventory";
import { nextNumber } from "@/lib/sequence";
import { recordAudit } from "@/core/audit";
import { toNumber } from "@/lib/format";
import type { PaymentMethod } from "@/lib/generated/prisma/client";

export type Receipt = {
  saleNo: string;
  dateISO: string;
  branchName: string;
  cashierName: string;
  customerName: string | null;
  lines: { name: string; variant: string | null; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  taxName: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  payments: { method: string; amount: number }[];
  change: number;
  pointsEarned: number;
  header: string;
  footer: string;
  currencySymbol: string;
};

export type CheckoutState =
  | { ok: true; receipt: Receipt }
  | { error: string }
  | undefined;

const METHODS: PaymentMethod[] = ["CASH", "CARD", "MOBILE_WALLET", "BANK_TRANSFER", "OTHER"];
const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export async function checkout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const ctx = await requireTenantContext();
  const { user, roleId } = await requirePermission("pos:write");

  const schema = z.object({
    branchId: z.string().min(1),
    customerId: z.preprocess(emptyToUndef, z.string().optional()),
    note: z.preprocess(emptyToUndef, z.string().trim().optional()),
    saleDiscount: z.coerce.number().nonnegative().default(0),
    items: z.string().min(2),
    payments: z.string().min(2),
  });
  const parsed = schema.safeParse({
    branchId: formData.get("branchId"),
    customerId: formData.get("customerId"),
    note: formData.get("note"),
    saleDiscount: formData.get("saleDiscount") ?? 0,
    items: formData.get("items"),
    payments: formData.get("payments"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  if (ctx.branchIds.length > 0 && !ctx.branchIds.includes(d.branchId)) {
    return { error: "forbidden" };
  }

  let rawItems: { variantId: string; quantity: number }[];
  let rawPayments: { method: string; amount: number; reference?: string }[];
  try {
    rawItems = JSON.parse(d.items);
    rawPayments = JSON.parse(d.payments);
  } catch {
    return { error: "invalid" };
  }
  rawItems = rawItems.filter((i) => i.variantId && i.quantity > 0);
  if (rawItems.length === 0) return { error: "empty" };

  const config = await getStoreConfigFresh(ctx.tenantId);
  const variants = await prisma.productVariant.findMany({
    where: { tenantId: ctx.tenantId, id: { in: rawItems.map((i) => i.variantId) } },
    include: { product: { select: { id: true, nameAr: true, nameEn: true } } },
  });
  const vmap = new Map(variants.map((v) => [v.id, v]));
  if (variants.length !== rawItems.length) return { error: "invalid" };

  const lines = rawItems.map((i) => {
    const v = vmap.get(i.variantId)!;
    return {
      variantId: i.variantId,
      quantity: i.quantity,
      unitPrice: toNumber(v.price),
      unitCost: toNumber(v.cost),
      product: v.product,
      variantLabel: v.optionEn,
    };
  });

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    config,
    d.saleDiscount,
    config.loyaltyPointsPerMoney,
  );

  if (d.saleDiscount > 0) {
    const mayDiscount = await can(
      { id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin },
      "pos:discount",
    );
    if (!mayDiscount) return { error: "discountNotAllowed" };
    const check = discountAllowed(d.saleDiscount, totals.subtotal, config);
    if (!check.ok) return { error: "discountNotAllowed" };
  }

  const payments = rawPayments
    .filter((p) => METHODS.includes(p.method as PaymentMethod) && p.amount > 0)
    .map((p) => ({
      method: p.method as PaymentMethod,
      amount: p.amount,
      reference: p.reference ?? null,
    }));
  const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  if (payments.length === 0) return { error: "noPayment" };
  if (paid + 0.005 < totals.total) return { error: "underpaid" };
  const change = Math.round((paid - totals.total) * 100) / 100;

  const saleNo = await nextNumber(ctx.tenantId, "SALE");

  let saleId: string;
  try {
    saleId = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: d.branchId,
          customerId: d.customerId ?? null,
          saleNo,
          status: "COMPLETED",
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxRate: totals.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          cashierId: ctx.userId,
          notes: d.note ?? null,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              variantId: l.variantId,
              productNameEn: l.product.nameEn,
              productNameAr: l.product.nameAr,
              variantLabel: l.variantLabel ?? null,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              unitCost: l.unitCost,
              total: Math.round(l.unitPrice * l.quantity * 100) / 100,
            })),
          },
          payments: {
            create: payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference,
              receivedBy: ctx.userId,
            })),
          },
        },
      });

      for (const l of lines) {
        await adjustStock(tx, {
          tenantId: ctx.tenantId,
          branchId: d.branchId,
          variantId: l.variantId,
          type: "SALE",
          quantity: -l.quantity,
          unitCost: l.unitCost,
          reference: saleNo,
          referenceId: sale.id,
          allowNegative: config.allowNegativeInventory,
          createdBy: ctx.userId,
        });
      }

      if (d.customerId && config.enableLoyalty && totals.loyaltyPointsEarned > 0) {
        await tx.customer.update({
          where: { id: d.customerId },
          data: { loyaltyPoints: { increment: totals.loyaltyPointsEarned } },
        });
      }
      return sale.id;
    });
  } catch (err) {
    if (err instanceof InventoryError) {
      return { error: err.code === "INSUFFICIENT_STOCK" ? "insufficientStock" : "invalid" };
    }
    throw err;
  }

  recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "create",
    entity: "Sale",
    entityId: saleId,
    metadata: { saleNo, total: totals.total },
  });

  const [branch, customer] = await Promise.all([
    prisma.branch.findUnique({ where: { id: d.branchId }, select: { nameAr: true, nameEn: true } }),
    d.customerId
      ? prisma.customer.findUnique({ where: { id: d.customerId }, select: { name: true, nameAr: true } })
      : Promise.resolve(null),
  ]);

  return {
    ok: true,
    receipt: {
      saleNo,
      dateISO: new Date().toISOString(),
      branchName: ctx.locale === "ar" ? (branch?.nameAr ?? "") : (branch?.nameEn ?? ""),
      cashierName: user.name,
      customerName: customer ? (ctx.locale === "ar" ? (customer.nameAr ?? customer.name) : customer.name) : null,
      lines: lines.map((l) => ({
        name: ctx.locale === "ar" ? l.product.nameAr : l.product.nameEn,
        variant: l.variantLabel ?? null,
        qty: l.quantity,
        unitPrice: l.unitPrice,
        total: Math.round(l.unitPrice * l.quantity * 100) / 100,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxName: ctx.locale === "ar" ? config.taxNameAr : config.taxNameEn,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      change,
      pointsEarned: totals.loyaltyPointsEarned,
      header: ctx.locale === "ar" ? config.receiptHeaderAr : config.receiptHeaderEn,
      footer: ctx.locale === "ar" ? config.receiptFooterAr : config.receiptFooterEn,
      currencySymbol: ctx.currencySymbol,
    },
  };
}

export type QuickCustomerState =
  | { ok?: boolean; id?: string; name?: string; error?: string }
  | undefined;

export async function quickCreateCustomer(
  _prev: QuickCustomerState,
  formData: FormData,
): Promise<QuickCustomerState> {
  const ctx = await requireTenantContext();
  await requirePermission("customers:write");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "invalid" };
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const created = await prisma.customer.create({
    data: { tenantId: ctx.tenantId, name, phone },
    select: { id: true, name: true },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Customer", entityId: created.id });
  return { ok: true, id: created.id, name: created.name };
}
