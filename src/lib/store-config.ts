import { cache } from "react";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/format";

/**
 * Business configuration for a tenant, stored as `Tenant.config` JSON.
 * No regional business rule is hardcoded: currency, tax, receipt text and
 * inventory rules are all store-configurable and enforced on the server.
 */
export type StoreConfig = {
  taxEnabled: boolean;
  taxRate: number; // percent, e.g. 15
  taxNameAr: string;
  taxNameEn: string;
  discountEnabled: boolean;
  maxDiscountPercent: number;
  allowNegativeInventory: boolean;
  lowStockThreshold: number;
  enableLoyalty: boolean;
  loyaltyPointsPerMoney: number; // points per 1 unit of currency
  receiptHeaderAr: string;
  receiptHeaderEn: string;
  receiptFooterAr: string;
  receiptFooterEn: string;
  showLogoOnReceipt: boolean;
};

const DEFAULTS: StoreConfig = {
  taxEnabled: false,
  taxRate: 0,
  taxNameAr: "الضريبة",
  taxNameEn: "Tax",
  discountEnabled: true,
  maxDiscountPercent: 100,
  allowNegativeInventory: false,
  lowStockThreshold: 5,
  enableLoyalty: false,
  loyaltyPointsPerMoney: 1,
  receiptHeaderAr: "",
  receiptHeaderEn: "",
  receiptFooterAr: "شكراً لزيارتكم",
  receiptFooterEn: "Thank you for your visit",
  showLogoOnReceipt: true,
};

export function mergeConfig(raw: unknown): StoreConfig {
  if (!raw || typeof raw !== "object") return DEFAULTS;
  const c = raw as Record<string, unknown>;
  return {
    taxEnabled: Boolean(c.taxEnabled ?? DEFAULTS.taxEnabled),
    taxRate: Number(c.taxRate ?? DEFAULTS.taxRate),
    taxNameAr: String(c.taxNameAr ?? DEFAULTS.taxNameAr),
    taxNameEn: String(c.taxNameEn ?? DEFAULTS.taxNameEn),
    discountEnabled: Boolean(c.discountEnabled ?? DEFAULTS.discountEnabled),
    maxDiscountPercent: Number(c.maxDiscountPercent ?? DEFAULTS.maxDiscountPercent),
    allowNegativeInventory: Boolean(
      c.allowNegativeInventory ?? DEFAULTS.allowNegativeInventory,
    ),
    lowStockThreshold: Number(c.lowStockThreshold ?? DEFAULTS.lowStockThreshold),
    enableLoyalty: Boolean(c.enableLoyalty ?? DEFAULTS.enableLoyalty),
    loyaltyPointsPerMoney: Number(
      c.loyaltyPointsPerMoney ?? DEFAULTS.loyaltyPointsPerMoney,
    ),
    receiptHeaderAr: String(c.receiptHeaderAr ?? DEFAULTS.receiptHeaderAr),
    receiptHeaderEn: String(c.receiptHeaderEn ?? DEFAULTS.receiptHeaderEn),
    receiptFooterAr: String(c.receiptFooterAr ?? DEFAULTS.receiptFooterAr),
    receiptFooterEn: String(c.receiptFooterEn ?? DEFAULTS.receiptFooterEn),
    showLogoOnReceipt: Boolean(c.showLogoOnReceipt ?? DEFAULTS.showLogoOnReceipt),
  };
}

const getRawConfig = cache(async (tenantId: string): Promise<unknown> => {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  return t?.config;
});

/** Read the tenant's business configuration (per-request cached). */
export function getStoreConfig(tenantId: string): Promise<StoreConfig> {
  return getRawConfig(tenantId).then(mergeConfig);
}

/** Persist a partial config update. */
export async function updateStoreConfig(
  tenantId: string,
  patch: Partial<StoreConfig>,
) {
  const current = await getRawConfig(tenantId);
  const merged = { ...mergeConfig(current), ...patch };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { config: merged as object },
  });
}

/** Config used server-side for calculation (non-cached). */
export async function getStoreConfigFresh(tenantId: string): Promise<StoreConfig> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  return mergeConfig(t?.config);
}

export function money(n: unknown): number {
  return toNumber(n);
}