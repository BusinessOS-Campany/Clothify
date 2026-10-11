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
  branchId: z.string().min(1),
  categoryId: z.preprocess(emptyToUndef, z.string().optional()),
  description: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "MOBILE_WALLET", "BANK_TRANSFER", "OTHER"]).default("CASH"),
  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),
});

export async function saveExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("expenses:write");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    branchId: formData.get("branchId"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    paymentMethod: formData.get("paymentMethod") ?? "CASH",
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const data = {
    branchId: d.branchId,
    categoryId: d.categoryId ?? null,
    description: d.description,
    amount: d.amount,
    expenseDate: new Date(d.expenseDate),
    paymentMethod: d.paymentMethod,
    notes: d.notes ?? null,
  };

  if (d.id) {
    await prisma.expense.update({ where: { id: d.id }, data });
    recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Expense", entityId: d.id });
    revalidatePath("/expenses");
    return { ok: true };
  }

  const created = await prisma.expense.create({
    data: { tenantId: ctx.tenantId, recordedBy: ctx.userId, ...data },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Expense", entityId: created.id });
  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission("expenses:write");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.expense.deleteMany({ where: { id, tenantId: ctx.tenantId } });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "delete", entity: "Expense", entityId: id });
  revalidatePath("/expenses");
  redirect({ href: "/expenses", locale: await getLocale() });
}

const categorySchema = z.object({
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  color: z.preprocess(emptyToUndef, z.string().trim().optional()),
});

export async function saveExpenseCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("expenses:write");
  const parsed = categorySchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  await prisma.expenseCategory.upsert({
    where: { tenantId_nameEn: { tenantId: ctx.tenantId, nameEn: d.nameEn } },
    create: { tenantId: ctx.tenantId, nameEn: d.nameEn, nameAr: d.nameAr, color: d.color ?? "#64748b" },
    update: { nameAr: d.nameAr, color: d.color ?? "#64748b" },
  });
  revalidatePath("/expenses");
  return { ok: true };
}
