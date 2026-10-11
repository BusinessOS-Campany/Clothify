import type { StoreConfig } from "@/lib/store-config";

export type LineInput = {
  unitPrice: number;
  quantity: number;
  discount?: number; // per-line discount amount
};

export type Totals = {
  subtotal: number;
  lineDiscounts: number;
  discount: number;
  taxableBase: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  loyaltyPointsEarned: number;
};

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Central sale total computation. All money math funnels through this
 * function so every screen (POS, credits, reports) agrees on the model:
 *   subtotal = Σ(line qty × unit_price) − Σ(line discounts)
 *   taxable  = subtotal − sale-level discount
 *   tax      = taxable × taxRate%
 *   total    = taxable + tax
 */
export function computeTotals(
  lines: LineInput[],
  config: Pick<StoreConfig, "taxEnabled" | "taxRate" | "enableLoyalty">,
  saleDiscount = 0,
  currencyPerPoint = 1,
): Totals {
  const subtotalRaw = lines.reduce(
    (acc, l) => acc + l.unitPrice * l.quantity,
    0,
  );
  const lineDiscounts = r2(
    lines.reduce((acc, l) => acc + (l.discount ?? 0), 0),
  );
  const subtotal = r2(subtotalRaw - lineDiscounts);
  const discount = Math.min(r2(saleDiscount), subtotal);
  const taxableBase = r2(Math.max(subtotal - discount, 0));
  const taxRate = config.taxEnabled ? config.taxRate : 0;
  const taxAmount = r2((taxableBase * taxRate) / 100);
  const total = r2(taxableBase + taxAmount);

  const pointsPerCurrency = config.enableLoyalty ? currencyPerPoint : 0;
  const loyaltyPointsEarned = Math.floor(total * pointsPerCurrency);

  return {
    subtotal,
    lineDiscounts,
    discount,
    taxableBase,
    taxRate,
    taxAmount,
    total,
    loyaltyPointsEarned,
  };
}

export { r2 as round2 };

/** Validate a discount against the store's discount permission. */
export function discountAllowed(
  discount: number,
  total: number,
  config: Pick<StoreConfig, "discountEnabled" | "maxDiscountPercent">,
): { ok: boolean; max: number } {
  if (!config.discountEnabled || discount === 0) return { ok: true, max: 0 };
  const max = r2((total * config.maxDiscountPercent) / 100);
  return { ok: discount <= max + 0.005, max };
}