"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { assertPlanLimit, PlanLimitError } from "@/core/subscriptions";
import { recordAudit } from "@/core/audit";

export type ActionState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string> }
  | undefined;

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const numberish = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().finite().nonnegative().optional(),
);

const productSchema = z.object({
  id: z.string().optional(),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.preprocess(emptyToUndef, z.string().trim().optional()),
  categoryId: z.preprocess(emptyToUndef, z.string().optional()),
  brandId: z.preprocess(emptyToUndef, z.string().optional()),
  supplierId: z.preprocess(emptyToUndef, z.string().optional()),
  cost: numberish,
  price: numberish,
  compareAtPrice: numberish,
  gender: z.enum(["UNISEX", "MEN", "WOMEN", "KIDS", "BABY"]),
  season: z.preprocess(emptyToUndef, z.string().trim().optional()),
  material: z.preprocess(emptyToUndef, z.string().trim().optional()),
  descriptionEn: z.preprocess(emptyToUndef, z.string().trim().optional()),
  descriptionAr: z.preprocess(emptyToUndef, z.string().trim().optional()),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    id: emptyToUndef(formData.get("id")),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    sku: formData.get("sku"),
    barcode: formData.get("barcode"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId"),
    supplierId: formData.get("supplierId"),
    cost: formData.get("cost"),
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice"),
    gender: formData.get("gender"),
    season: formData.get("season"),
    material: formData.get("material"),
    descriptionEn: formData.get("descriptionEn"),
    descriptionAr: formData.get("descriptionAr"),
    status: formData.get("status"),
    isActive: formData.get("isActive"),
  });
}

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("products:write");
  const parsed = parseProduct(formData);
  if (!parsed.success) {
    return {
      error: "invalid",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const d = parsed.data;

  const dupe = await prisma.product.findFirst({
    where: { tenantId: ctx.tenantId, sku: d.sku, ...(d.id ? { id: { not: d.id } } : {}) },
    select: { id: true },
  });
  if (dupe) return { error: "skuTaken" };

  const payload = {
    nameEn: d.nameEn,
    nameAr: d.nameAr,
    sku: d.sku,
    barcode: d.barcode ?? null,
    categoryId: d.categoryId ?? null,
    brandId: d.brandId ?? null,
    supplierId: d.supplierId ?? null,
    cost: d.cost ?? 0,
    price: d.price ?? 0,
    compareAtPrice: d.compareAtPrice ?? null,
    gender: d.gender,
    season: d.season ?? null,
    material: d.material ?? null,
    descriptionEn: d.descriptionEn ?? null,
    descriptionAr: d.descriptionAr ?? null,
    status: d.status,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await prisma.product.update({ where: { id: d.id }, data: payload });
      recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Product", entityId: d.id });
      revalidatePath("/products");
      redirect({ href: "/products", locale: await getLocale() });
    }
    const created = await prisma.$transaction(async (tx) => {
      await assertPlanLimit(ctx.tenantId, "PRODUCT", tx);
      return tx.product.create({ data: { tenantId: ctx.tenantId, ...payload } });
    });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Product", entityId: created.id });
    revalidatePath("/products");
    redirect({ href: `/products/${created.id}`, locale: await getLocale() });
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: "planLimit" };
    throw err;
  }
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("products:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sales = await prisma.saleItem.count({ where: { productId: id } });
  if (sales > 0) {
    await prisma.product.update({ where: { id }, data: { isActive: false, status: "ARCHIVED" } });
  } else {
    await prisma.product.delete({ where: { id } });
  }
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "delete", entity: "Product", entityId: id });
  revalidatePath("/products");
  redirect({ href: "/products", locale: await getLocale() });
}

const variantSchema = z.object({
  productId: z.string().min(1),
  id: z.string().optional(),
  sku: z.preprocess(emptyToUndef, z.string().trim().optional()),
  barcode: z.preprocess(emptyToUndef, z.string().trim().optional()),
  color: z.preprocess(emptyToUndef, z.string().trim().optional()),
  size: z.preprocess(emptyToUndef, z.string().trim().optional()),
  price: numberish,
  cost: numberish,
  compareAtPrice: numberish,
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveVariant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("products:write");
  const parsed = variantSchema.safeParse({
    productId: formData.get("productId"),
    id: emptyToUndef(formData.get("id")),
    sku: formData.get("sku"),
    barcode: formData.get("barcode"),
    color: formData.get("color"),
    size: formData.get("size"),
    price: formData.get("price"),
    cost: formData.get("cost"),
    compareAtPrice: formData.get("compareAtPrice"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: d.productId, tenantId: ctx.tenantId },
    select: { id: true, sku: true },
  });
  if (!product) return { error: "notFound" };

  const label = [d.color, d.size].filter(Boolean).join(" / ");
  const sku =
    d.sku ||
    `${product.sku}-${(d.color ?? "x").slice(0, 3).toUpperCase()}${d.size ? `-${d.size}` : ""}`;
  const data = {
    sku,
    barcode: d.barcode ?? null,
    attributes: { color: d.color ?? null, size: d.size ?? null },
    optionEn: label || null,
    optionAr: label || null,
    price: d.price ?? 0,
    cost: d.cost ?? 0,
    compareAtPrice: d.compareAtPrice ?? null,
    isActive: d.isActive,
  };

  if (d.id) {
    await prisma.productVariant.update({ where: { id: d.id }, data });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "ProductVariant", entityId: d.id });
  } else {
    await prisma.productVariant.create({
      data: { tenantId: ctx.tenantId, productId: product.id, ...data },
    });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "ProductVariant", entityId: product.id });
  }
  revalidatePath(`/products/${product.id}`);
  return { ok: true };
}

export async function deleteVariant(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("products:write");
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!id) return;
  const sold = await prisma.saleItem.count({ where: { variantId: id } });
  if (sold > 0) {
    await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.productVariant.delete({ where: { id } });
  }
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "delete", entity: "ProductVariant", entityId: id });
  revalidatePath(`/products/${productId}`);
}
