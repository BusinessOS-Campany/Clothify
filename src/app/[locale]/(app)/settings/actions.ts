"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { updateStoreConfig } from "@/lib/store-config";
import { recordAudit } from "@/core/audit";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

async function requireManage(): Promise<{ tenantId: string; userId: string }> {
  const ctx = await requireTenantContext();
  await requirePermission("settings:read");
  const user = await requireUser();
  if (!user.isPlatformAdmin && ctx.roleCode !== "owner") throw new Error("FORBIDDEN");
  return { tenantId: ctx.tenantId, userId: ctx.userId };
}

const storeSchema = z.object({
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  email: z.preprocess(emptyToUndef, z.string().trim().email().optional()),
  address: z.preprocess(emptyToUndef, z.string().trim().optional()),
  vatNumber: z.preprocess(emptyToUndef, z.string().trim().optional()),
  logoUrl: z.preprocess(emptyToUndef, z.string().trim().optional()),
  currency: z.string().trim().min(1).max(8),
  currencySymbol: z.string().trim().min(1).max(4),
  timezone: z.string().trim().min(1),
  dateFormat: z.string().trim().min(1),
  locale: z.enum(["ar", "en"]),
});

export async function updateStoreProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: { tenantId: string; userId: string };
  try {
    ids = await requireManage();
  } catch {
    return { error: "forbidden" };
  }
  const parsed = storeSchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    vatNumber: formData.get("vatNumber"),
    logoUrl: formData.get("logoUrl"),
    currency: formData.get("currency"),
    currencySymbol: formData.get("currencySymbol"),
    timezone: formData.get("timezone"),
    dateFormat: formData.get("dateFormat"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  await prisma.tenant.update({
    where: { id: ids.tenantId },
    data: {
      nameEn: d.nameEn,
      nameAr: d.nameAr,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      vatNumber: d.vatNumber ?? null,
      logoUrl: d.logoUrl ?? null,
      currency: d.currency,
      currencySymbol: d.currencySymbol,
      timezone: d.timezone,
      dateFormat: d.dateFormat,
      locale: d.locale,
    },
  });
  recordAudit({ tenantId: ids.tenantId, actorId: ids.userId, action: "update", entity: "TenantSettings" });
  revalidatePath("/settings");
  return { ok: true };
}

const taxSchema = z.object({
  taxEnabled: bool,
  taxRate: z.coerce.number().min(0).max(100),
  taxNameEn: z.string().trim().min(1),
  taxNameAr: z.string().trim().min(1),
  discountEnabled: bool,
  maxDiscountPercent: z.coerce.number().min(0).max(100),
  enableLoyalty: bool,
  loyaltyPointsPerMoney: z.coerce.number().min(0),
});

export async function updateTaxSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: { tenantId: string; userId: string };
  try {
    ids = await requireManage();
  } catch {
    return { error: "forbidden" };
  }
  const parsed = taxSchema.safeParse({
    taxEnabled: formData.get("taxEnabled"),
    taxRate: formData.get("taxRate"),
    taxNameEn: formData.get("taxNameEn"),
    taxNameAr: formData.get("taxNameAr"),
    discountEnabled: formData.get("discountEnabled"),
    maxDiscountPercent: formData.get("maxDiscountPercent"),
    enableLoyalty: formData.get("enableLoyalty"),
    loyaltyPointsPerMoney: formData.get("loyaltyPointsPerMoney"),
  });
  if (!parsed.success) return { error: "invalid" };
  await updateStoreConfig(ids.tenantId, parsed.data);
  recordAudit({ tenantId: ids.tenantId, actorId: ids.userId, action: "update", entity: "TenantSettings", entityId: "tax" });
  revalidatePath("/settings");
  return { ok: true };
}

const inventorySchema = z.object({
  allowNegativeInventory: bool,
  lowStockThreshold: z.coerce.number().int().min(0),
});

export async function updateInventorySettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: { tenantId: string; userId: string };
  try {
    ids = await requireManage();
  } catch {
    return { error: "forbidden" };
  }
  const parsed = inventorySchema.safeParse({
    allowNegativeInventory: formData.get("allowNegativeInventory"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) return { error: "invalid" };
  await updateStoreConfig(ids.tenantId, parsed.data);
  recordAudit({ tenantId: ids.tenantId, actorId: ids.userId, action: "update", entity: "TenantSettings", entityId: "inventory" });
  revalidatePath("/settings");
  return { ok: true };
}

const receiptSchema = z.object({
  receiptHeaderEn: z.string().trim().default(""),
  receiptHeaderAr: z.string().trim().default(""),
  receiptFooterEn: z.string().trim().default(""),
  receiptFooterAr: z.string().trim().default(""),
  showLogoOnReceipt: bool,
});

export async function updateReceiptSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ids: { tenantId: string; userId: string };
  try {
    ids = await requireManage();
  } catch {
    return { error: "forbidden" };
  }
  const parsed = receiptSchema.safeParse({
    receiptHeaderEn: formData.get("receiptHeaderEn") ?? "",
    receiptHeaderAr: formData.get("receiptHeaderAr") ?? "",
    receiptFooterEn: formData.get("receiptFooterEn") ?? "",
    receiptFooterAr: formData.get("receiptFooterAr") ?? "",
    showLogoOnReceipt: formData.get("showLogoOnReceipt"),
  });
  if (!parsed.success) return { error: "invalid" };
  await updateStoreConfig(ids.tenantId, parsed.data);
  recordAudit({ tenantId: ids.tenantId, actorId: ids.userId, action: "update", entity: "TenantSettings", entityId: "receipt" });
  revalidatePath("/settings");
  return { ok: true };
}
