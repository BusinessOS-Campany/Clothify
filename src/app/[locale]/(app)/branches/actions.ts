"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { recordAudit } from "@/core/audit";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

async function requireManage(): Promise<void> {
  await requirePermission("branches:read");
  const user = await requireUser();
  const ctx = await requireTenantContext();
  const allowed = user.isPlatformAdmin || ctx.roleCode === "owner";
  if (!allowed) throw new Error("FORBIDDEN");
}

const schema = z.object({
  id: z.preprocess(emptyToUndef, z.string().optional()),
  code: z.string().trim().min(1).max(12),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  address: z.preprocess(emptyToUndef, z.string().trim().optional()),
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  managerId: z.preprocess(emptyToUndef, z.string().optional()),
  openingHours: z.preprocess(emptyToUndef, z.string().trim().optional()),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export async function saveBranch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  try {
    await requireManage();
  } catch {
    return { error: "forbidden" };
  }

  const parsed = schema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    managerId: formData.get("managerId"),
    openingHours: formData.get("openingHours"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const data = {
    code: d.code.toUpperCase(),
    nameAr: d.nameAr,
    nameEn: d.nameEn,
    address: d.address ?? null,
    phone: d.phone ?? null,
    managerId: d.managerId ?? null,
    openingHours: d.openingHours ? { note: d.openingHours } : undefined,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await prisma.branch.update({ where: { id: d.id }, data });
      recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Branch", entityId: d.id });
    } else {
      const created = await prisma.branch.create({ data: { tenantId: ctx.tenantId, ...data } });
      recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Branch", entityId: created.id });
    }
  } catch {
    return { error: "duplicate" };
  }

  revalidatePath("/branches");
  return { ok: true };
}
