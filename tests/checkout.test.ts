import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the POS checkout and Sales refund server actions.
 *
 * These run against a real PostgreSQL database (`clothify_test`, prepared by
 * tests/global-setup.ts) and exercise the actual action code paths. Only the
 * outer shell is mocked: the session/tenant context (no HTTP request here),
 * audit logging and Next.js navigation primitives.
 */

const { mockCtx, mockUser, mockCan } = vi.hoisted(() => ({
  mockCtx: { current: null as Record<string, unknown> | null },
  mockUser: { current: null as Record<string, unknown> | null },
  mockCan: vi.fn(async () => true),
}));

vi.mock("@/core/tenant", () => ({
  requireTenantContext: vi.fn(async () => mockCtx.current),
}));
vi.mock("@/core/auth/session", () => ({
  requirePermission: vi.fn(async () => ({ user: mockUser.current, roleId: "role" })),
}));
vi.mock("@/core/rbac", () => ({
  can: (...args: unknown[]) => mockCan(...(args as [])),
}));
vi.mock("@/core/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));

import { checkout } from "@/app/[locale]/(app)/pos/actions";
import { processRefund } from "@/app/[locale]/(app)/sales/actions";
import { prisma } from "@/lib/db";

let tenantId: string;
let branchId: string;
let userId: string;
let categoryId: string;

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Creates an isolated product+variant with a known stock level at a branch. */
async function makeVariant(opts: { stock: number; price?: number; cost?: number; label: string }) {
  const price = opts.price ?? 100;
  const cost = opts.cost ?? 40;
  const product = await prisma.product.create({
    data: {
      tenantId,
      nameEn: `Test Product ${opts.label}`,
      nameAr: `منتج ${opts.label}`,
      sku: `T-${opts.label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      categoryId,
      status: "ACTIVE",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      tenantId,
      productId: product.id,
      sku: product.sku,
      optionEn: "Default",
      optionAr: "افتراضي",
      cost,
      price,
    },
  });
  await prisma.inventoryBalance.create({
    data: { tenantId, branchId, variantId: variant.id, quantity: opts.stock },
  });
  return { product, variant, price, cost };
}

async function balanceOf(variantId: string): Promise<number> {
  const bal = await prisma.inventoryBalance.findUnique({
    where: { branchId_variantId: { branchId, variantId } },
  });
  return bal?.quantity ?? 0;
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "zahra-fashion" } });
  tenantId = tenant.id;

  const branch = await prisma.branch.findFirstOrThrow({
    where: { tenantId, code: "MAIN" },
  });
  branchId = branch.id;

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@clothify.local" },
  });
  userId = admin.id;

  const category = await prisma.category.findFirstOrThrow({ where: { tenantId } });
  categoryId = category.id;

  mockCtx.current = {
    userId,
    tenantId,
    tenantCode: tenant.code,
    tenantNameAr: tenant.nameAr,
    tenantNameEn: tenant.nameEn,
    currency: tenant.currency,
    currencySymbol: tenant.currencySymbol,
    locale: "en",
    membershipId: "test-membership",
    roleId: "test-role",
    roleCode: "owner",
    branchIds: [],
  };
  mockUser.current = { id: userId, name: admin.name, isPlatformAdmin: true };
});

beforeEach(() => {
  mockCan.mockReset();
  mockCan.mockResolvedValue(true);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("checkout", () => {
  it("creates a completed sale, computes totals and decrements stock", async () => {
    const { variant } = await makeVariant({ stock: 10, label: "happy" });

    const res = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "0",
        items: JSON.stringify([{ variantId: variant.id, quantity: 2 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 210 }]),
      }),
    );

    if (!res || !("ok" in res) || !res.ok) throw new Error("expected ok");
    expect(res.receipt.subtotal).toBe(200);
    expect(res.receipt.taxAmount).toBe(10); // 5% of 200
    expect(res.receipt.total).toBe(210);
    expect(res.receipt.change).toBe(0);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: (await prisma.sale.findFirstOrThrow({ where: { saleNo: res.receipt.saleNo } })).id },
      include: { items: true, payments: true },
    });
    expect(sale.status).toBe("COMPLETED");
    expect(sale.total.toNumber()).toBe(210);
    expect(sale.items).toHaveLength(1);
    expect(sale.payments).toHaveLength(1);

    expect(await balanceOf(variant.id)).toBe(8);
  });

  it("rejects underpaid sales without creating a sale", async () => {
    const { variant } = await makeVariant({ stock: 5, label: "under" });
    const before = await prisma.sale.count({ where: { tenantId } });

    const res = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "0",
        items: JSON.stringify([{ variantId: variant.id, quantity: 1 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 1 }]),
      }),
    );

    expect(res).toEqual({ error: "underpaid" });
    expect(await prisma.sale.count({ where: { tenantId } })).toBe(before);
    expect(await balanceOf(variant.id)).toBe(5);
  });

  it("refuses to oversell when stock is insufficient", async () => {
    const { variant } = await makeVariant({ stock: 1, label: "oversell" });

    const res = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "0",
        items: JSON.stringify([{ variantId: variant.id, quantity: 2 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 1000 }]),
      }),
    );

    expect(res).toEqual({ error: "insufficientStock" });
    expect(await balanceOf(variant.id)).toBe(1);
  });

  it("rejects a discount when the user lacks pos:discount", async () => {
    mockCan.mockResolvedValue(false);
    const { variant } = await makeVariant({ stock: 5, label: "nodisc" });

    const res = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "10",
        items: JSON.stringify([{ variantId: variant.id, quantity: 1 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 100 }]),
      }),
    );

    expect(res).toEqual({ error: "discountNotAllowed" });
    expect(await balanceOf(variant.id)).toBe(5);
  });

  it("applies a permitted discount before tax", async () => {
    const { variant } = await makeVariant({ stock: 5, label: "disc" });

    const res = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "20",
        items: JSON.stringify([{ variantId: variant.id, quantity: 1 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 84 }]),
      }),
    );

    if (!res || !("ok" in res) || !res.ok) throw new Error("expected ok");
    expect(res.receipt.subtotal).toBe(100);
    expect(res.receipt.discount).toBe(20);
    expect(res.receipt.taxAmount).toBe(4); // 5% of 80
    expect(res.receipt.total).toBe(84);
  });
});

describe("processRefund", () => {
  it("restocks resellable items and marks the sale refunded", async () => {
    const { variant } = await makeVariant({ stock: 10, label: "refund" });

    const saleRes = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "0",
        items: JSON.stringify([{ variantId: variant.id, quantity: 3 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 315 }]),
      }),
    );
    if (!saleRes || !("ok" in saleRes) || !saleRes.ok) throw new Error("checkout failed");
    expect(await balanceOf(variant.id)).toBe(7);

    const sale = await prisma.sale.findFirstOrThrow({
      where: { tenantId, saleNo: saleRes.receipt.saleNo },
      include: { items: true },
    });
    const item = sale.items[0]!;

    const res = await processRefund(
      undefined,
      formData({
        saleId: sale.id,
        reason: "customer changed mind",
        items: JSON.stringify([
          { saleItemId: item.id, quantity: 3, condition: "RESELLABLE" },
        ]),
      }),
    );

    expect(res).toBeUndefined(); // redirects on success

    expect(await balanceOf(variant.id)).toBe(10);
    const refunded = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(refunded.status).toBe("REFUNDED");

    const refund = await prisma.refund.findFirstOrThrow({
      where: { saleId: sale.id },
      include: { items: true },
    });
    expect(refund.items[0]!.restocked).toBe(true);
  });

  it("does not restock damaged items", async () => {
    const { variant } = await makeVariant({ stock: 10, label: "damaged" });

    const saleRes = await checkout(
      undefined,
      formData({
        branchId,
        saleDiscount: "0",
        items: JSON.stringify([{ variantId: variant.id, quantity: 2 }]),
        payments: JSON.stringify([{ method: "CASH", amount: 210 }]),
      }),
    );
    if (!saleRes || !("ok" in saleRes) || !saleRes.ok) throw new Error("checkout failed");

    const sale = await prisma.sale.findFirstOrThrow({
      where: { tenantId, saleNo: saleRes.receipt.saleNo },
      include: { items: true },
    });
    const item = sale.items[0]!;

    await processRefund(
      undefined,
      formData({
        saleId: sale.id,
        reason: "damaged",
        items: JSON.stringify([
          { saleItemId: item.id, quantity: 2, condition: "DAMAGED" },
        ]),
      }),
    );

    expect(await balanceOf(variant.id)).toBe(8); // not restocked

    const refund = await prisma.refund.findFirstOrThrow({
      where: { saleId: sale.id },
      include: { items: true },
    });
    expect(refund.items[0]!.restocked).toBe(false);
  });
});
