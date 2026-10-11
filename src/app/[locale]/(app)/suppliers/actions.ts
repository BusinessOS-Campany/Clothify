"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { recordAudit } from "@/core/audit";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

const schema = z.object({
  id: z.preprocess(emptyToUndef, z.string().optional()),
  name: z.string().trim().min(1),
  nameAr: z.preprocess(emptyToUndef, z.string().trim().optional()),
  contactName: z.preprocess(emptyToUndef, z.string().trim().optional()),
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  email: z.preprocess(emptyToUndef, z.string().trim().email().optional()),
  address: z.preprocess(emptyToUndef, z.string().trim().optional()),
  taxId: z.preprocess(emptyToUndef, z.string().trim().optional()),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveSupplier(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("suppliers:write");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    nameAr: formData.get("nameAr"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    notes: formData.get("notes"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const payload = {
    name: d.name,
    nameAr: d.nameAr ?? null,
    contactName: d.contactName ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    address: d.address ?? null,
    taxId: d.taxId ?? null,
    notes: d.notes ?? null,
    isActive: d.isActive,
  };

  if (d.id) {
    await prisma.supplier.update({ where: { id: d.id }, data: payload });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Supplier", entityId: d.id });
    revalidatePath("/suppliers");
    return { ok: true };
  }
  const created = await prisma.supplier.create({ data: { tenantId: ctx.tenantId, ...payload } });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Supplier", entityId: created.id });
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function deleteSupplier(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("suppliers:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const pos = await prisma.purchaseOrder.count({ where: { supplierId: id } });
  if (pos > 0) {
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.supplier.delete({ where: { id } });
  }
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "delete", entity: "Supplier", entityId: id });
  revalidatePath("/suppliers");
  redirect({ href: "/suppliers", locale: await getLocale() });
}
