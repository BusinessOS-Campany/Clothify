"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/core/auth/server";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { recordAudit } from "@/core/audit";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

const branchIds = z.preprocess(
  (v) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []),
  z.array(z.string()),
);

const inviteSchema = z.object({
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  email: z.string().trim().email(),
  username: z.string().trim().min(3),
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  password: z.string().min(6),
  roleCode: z.string().min(1),
  jobTitle: z.preprocess(emptyToUndef, z.string().trim().optional()),
  hireDate: z.preprocess(emptyToUndef, z.string().optional()),
  branchIds,
});

export async function inviteEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("employees:write");

  const parsed = inviteSchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    roleCode: formData.get("roleCode"),
    jobTitle: formData.get("jobTitle"),
    hireDate: formData.get("hireDate"),
    branchIds: formData.getAll("branchIds"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const role = await prisma.role.findUnique({ where: { code: d.roleCode }, select: { id: true } });
  if (!role) return { error: "invalid" };

  const existing = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (existing) {
    const member = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: ctx.tenantId, userId: existing.id } },
      select: { id: true },
    });
    if (member) return { error: "exists" };
  }

  let userId = existing?.id;
  if (!userId) {
    const res = await auth.api.signUpEmail({
      body: {
        email: d.email,
        password: d.password,
        name: d.nameEn,
        username: d.username,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        phone: d.phone ?? null,
      },
    });
    userId = res.user.id;
  } else {
    const hashed = await hashPassword(d.password);
    await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashed },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      phone: d.phone ?? null,
      username: d.username,
      displayUsername: d.username,
      isActive: true,
    },
  });

  const member = await prisma.tenantMember.create({
    data: {
      tenantId: ctx.tenantId,
      userId,
      roleId: role.id,
      jobTitle: d.jobTitle ?? null,
      hireDate: d.hireDate ? new Date(d.hireDate) : null,
      branches: {
        create: d.branchIds.map((branchId) => ({ branchId })),
      },
    },
  });

  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "create", entity: "Employee", entityId: member.id });
  revalidatePath("/employees");
  return { ok: true };
}

const updateSchema = z.object({
  memberId: z.string().min(1),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  phone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  roleCode: z.string().min(1),
  jobTitle: z.preprocess(emptyToUndef, z.string().trim().optional()),
  hireDate: z.preprocess(emptyToUndef, z.string().optional()),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  branchIds,
});

export async function updateEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("employees:write");

  const parsed = updateSchema.safeParse({
    memberId: formData.get("memberId"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    phone: formData.get("phone"),
    roleCode: formData.get("roleCode"),
    jobTitle: formData.get("jobTitle"),
    hireDate: formData.get("hireDate"),
    isActive: formData.get("isActive"),
    branchIds: formData.getAll("branchIds"),
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const member = await prisma.tenantMember.findFirst({
    where: { id: d.memberId, tenantId: ctx.tenantId },
    select: { id: true, userId: true },
  });
  if (!member) return { error: "invalid" };

  const role = await prisma.role.findUnique({ where: { code: d.roleCode }, select: { id: true } });
  if (!role) return { error: "invalid" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: member.userId },
      data: { nameAr: d.nameAr, nameEn: d.nameEn, phone: d.phone ?? null, isActive: d.isActive },
    }),
    prisma.tenantMember.update({
      where: { id: member.id },
      data: {
        roleId: role.id,
        jobTitle: d.jobTitle ?? null,
        hireDate: d.hireDate ? new Date(d.hireDate) : null,
        isActive: d.isActive,
      },
    }),
    prisma.tenantMemberBranch.deleteMany({ where: { memberId: member.id } }),
    prisma.tenantMemberBranch.createMany({
      data: d.branchIds.map((branchId) => ({ memberId: member.id, branchId })),
    }),
  ]);

  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Employee", entityId: member.id });
  revalidatePath("/employees");
  return { ok: true };
}

const passwordSchema = z.object({
  memberId: z.string().min(1),
  password: z.string().min(6),
});

export async function setEmployeePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("employees:write");
  const parsed = passwordSchema.safeParse({
    memberId: formData.get("memberId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };

  const member = await prisma.tenantMember.findFirst({
    where: { id: parsed.data.memberId, tenantId: ctx.tenantId },
    select: { userId: true },
  });
  if (!member) return { error: "invalid" };

  const hashed = await hashPassword(parsed.data.password);
  await prisma.account.updateMany({
    where: { userId: member.userId, providerId: "credential" },
    data: { password: hashed },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "EmployeePassword", entityId: member.userId });
  revalidatePath("/employees");
  return { ok: true };
}
