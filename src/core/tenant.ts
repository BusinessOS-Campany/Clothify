import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/core/auth/session";

export type TenantContext = {
  userId: string;
  tenantId: string;
  tenantCode: string;
  tenantNameAr: string;
  tenantNameEn: string;
  currency: string;
  currencySymbol: string;
  locale: "ar" | "en";
  membershipId: string;
  roleId: string;
  roleCode: string;
  /**
   * Branch ids the user may access. Empty means the user can access all
   * branches of the tenant.
   */
  branchIds: string[];
};

const loadContext = cache(
  async (userId: string, tenantId: string): Promise<TenantContext | null> => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        code: true,
        nameAr: true,
        nameEn: true,
        currency: true,
        currencySymbol: true,
        locale: true,
      },
    });
    if (!tenant) return null;

    const member = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: {
        id: true,
        roleId: true,
        role: { select: { code: true } },
        branches: { select: { branchId: true } },
      },
    });
    if (!member) return null;

    return {
      userId,
      tenantId,
      tenantCode: tenant.code,
      tenantNameAr: tenant.nameAr,
      tenantNameEn: tenant.nameEn,
      currency: tenant.currency,
      currencySymbol: tenant.currencySymbol,
      locale: (tenant.locale as "ar" | "en") ?? "en",
      membershipId: member.id,
      roleId: member.roleId,
      roleCode: member.role.code,
      branchIds: member.branches.map((b) => b.branchId),
    };
  },
);

/**
 * Resolves the tenant context for the current user (redirects when missing).
 * Branch-scoped queries should combine `tenantId` with `branchFilter(ctx)`.
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const user = await requireUser();
  if (!user.currentTenantId) redirect("/onboarding");
  const ctx = await loadContext(user.id, user.currentTenantId);
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const user = await requireUser();
  if (!user.currentTenantId) return null;
  return loadContext(user.id, user.currentTenantId);
}

/** Prisma where fragment limiting a query to the user's authorized branches. */
export function branchFilter(ctx: TenantContext): { branchId: { in: string[] } } | Record<string, never> {
  if (ctx.branchIds.length === 0) return {};
  return { branchId: { in: ctx.branchIds } };
}

export function isBranchAllowed(ctx: TenantContext, branchId: string): boolean {
  if (ctx.branchIds.length === 0) return true;
  return ctx.branchIds.includes(branchId);
}

export function isPlatformAdmin(user: SessionUser): boolean {
  return user.isPlatformAdmin;
}