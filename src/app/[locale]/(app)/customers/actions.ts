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
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  phone2: z.preprocess(emptyToUndef, z.string().trim().optional()),
  email: z.preprocess(emptyToUndef, z.string().trim().email().optional()),
  address: z.preprocess(emptyToUndef, z.string().trim().optional()),
  segment: z.preprocess(emptyToUndef, z.string().trim().optional()),
  creditLimit: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().nonnegative().optional(),
  ),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveCustomer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("customers:write");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    nameAr: formData.get("nameAr"),
    phone: formData.get("phone"),
    phone2: formData.get("phone2"),
    email: formData.get("email"),
    address: formData.get("address"),
    segment: formData.get("segment"),
    creditLimit: formData.get("creditLimit"),
    notes: formData.get("notes"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const payload = {
    name: d.name,
    nameAr: d.nameAr ?? null,
    phone: d.phone ?? null,
    phone2: d.phone2 ?? null,
    email: d.email ?? null,
    address: d.address ?? null,
    segment: d.segment ?? null,
    creditLimit: d.creditLimit ?? null,
    notes: d.notes ?? null,
    isActive: d.isActive,
  };

  if (d.id) {
    await prisma.customer.update({ where: { id: d.id }, data: payload });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Customer", entityId: d.id });
    revalidatePath("/customers");
    revalidatePath(`/customers/${d.id}`);
    return { ok: true };
  }

  const created = await prisma.customer.create({
    data: { tenantId: ctx.tenantId, ...payload },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Customer", entityId: created.id });
  revalidatePath("/customers");
  redirect({ href: `/customers/${created.id}`, locale: await getLocale() });
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("customers:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sales = await prisma.sale.count({ where: { customerId: id } });
  if (sales > 0) {
    await prisma.customer.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.customer.delete({ where: { id } });
  }
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "delete", entity: "Customer", entityId: id });
  revalidatePath("/customers");
  redirect({ href: "/customers", locale: await getLocale() });
}
