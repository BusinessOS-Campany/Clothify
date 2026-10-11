import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/core/auth/server";
import { prisma } from "@/lib/db";
import { can } from "@/core/rbac";
import type { PermissionCode } from "@/core/rbac/catalog";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  phone?: string | null;
  isPlatformAdmin: boolean;
  currentTenantId?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as SessionUser;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    nameAr: u.nameAr ?? null,
    nameEn: u.nameEn ?? null,
    phone: u.phone ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
    currentTenantId: u.currentTenantId ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Requires an authenticated user AND an active membership in a tenant.
 * Platform administrators can operate across tenants via a chosen
 * `currentTenantId` (set at sign-in / onboarding).
 */
export async function requireTenant(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.currentTenantId) redirect("/onboarding");
  return user;
}

export async function requirePermission(
  permission: PermissionCode,
): Promise<{ user: SessionUser; roleId: string }> {
  const user = await requireTenant();
  const roleId = await resolveRoleId(user);
  const allowed = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, permission);
  if (!allowed) redirect("/403");
  return { user, roleId };
}

const getRoleForTenant = cache(
  async (userId: string, tenantId: string): Promise<string | null> =>
    prisma.tenantMember
      .findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { roleId: true },
      })
      .then((m) => m?.roleId ?? null),
);

export async function resolveRoleId(user: SessionUser): Promise<string> {
  if (!user.currentTenantId) return "";
  return (await getRoleForTenant(user.id, user.currentTenantId)) ?? "";
}