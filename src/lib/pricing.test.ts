import { describe, expect, it } from "vitest";
import { computeTotals, discountAllowed, round2 } from "./pricing";

const baseConfig = {
  taxEnabled: true,
  taxRate: 10,
  enableLoyalty: true,
};

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe("computeTotals", () => {
  it("computes subtotal, tax and total for simple lines", () => {
    const t = computeTotals(
      [
        { unitPrice: 100, quantity: 2 },
        { unitPrice: 50, quantity: 1 },
      ],
      baseConfig,
    );
    expect(t.subtotal).toBe(250);
    expect(t.taxRate).toBe(10);
    expect(t.taxAmount).toBe(25);
    expect(t.total).toBe(275);
  });

  it("subtracts per-line discounts from the subtotal", () => {
    const t = computeTotals(
      [{ unitPrice: 100, quantity: 1, discount: 20 }],
      baseConfig,
    );
    expect(t.lineDiscounts).toBe(20);
    expect(t.subtotal).toBe(80);
    expect(t.total).toBe(88);
  });

  it("applies the sale-level discount before tax and clamps at subtotal", () => {
    const t = computeTotals([{ unitPrice: 100, quantity: 1 }], baseConfig, 500);
    expect(t.discount).toBe(100);
    expect(t.taxableBase).toBe(0);
    expect(t.total).toBe(0);
  });

  it("ignores tax when disabled", () => {
    const t = computeTotals([{ unitPrice: 100, quantity: 1 }], {
      ...baseConfig,
      taxEnabled: false,
    });
    expect(t.taxRate).toBe(0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(100);
  });

  it("awards loyalty points only when enabled", () => {
    const enabled = computeTotals([{ unitPrice: 100, quantity: 1 }], baseConfig, 0, 2);
    expect(enabled.loyaltyPointsEarned).toBe(Math.floor(110 * 2));

    const disabled = computeTotals([{ unitPrice: 100, quantity: 1 }], {
      ...baseConfig,
      enableLoyalty: false,
    });
    expect(disabled.loyaltyPointsEarned).toBe(0);
  });
});

describe("discountAllowed", () => {
  const cfg = { discountEnabled: true, maxDiscountPercent: 20 };

  it("allows discounts within the configured maximum", () => {
    expect(discountAllowed(15, 100, cfg).ok).toBe(true);
  });

  it("rejects discounts above the maximum", () => {
    expect(discountAllowed(25, 100, cfg).ok).toBe(false);
  });

  it("scales the cap with the sale total", () => {
    expect(discountAllowed(100, 100, { discountEnabled: true, maxDiscountPercent: 100 }).ok).toBe(true);
    expect(discountAllowed(100, 100, cfg).ok).toBe(false);
  });
});
