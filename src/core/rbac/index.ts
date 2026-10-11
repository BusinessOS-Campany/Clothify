import { cache } from "react";
import { prisma } from "@/lib/db";
import { ROLE_PERMISSIONS, type RoleCode } from "./catalog";
import type { PermissionCode } from "./catalog";

type AuthUser = {
  id: string;
  roleId?: string;
  isPlatformAdmin?: boolean;
};

const loadRole = cache(async (roleId: string) => {
  if (!roleId) return { code: null, permissions: new Set<string>() };
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      code: true,
      permissions: { select: { permission: { select: { code: true } } } },
    },
  });
  return {
    code: role?.code ?? null,
    permissions: new Set(
      (role?.permissions ?? []).map((p) => p.permission.code),
    ),
  };
});

/**
 * Server-side authorization check. Platform administrators bypass module
 * checks; every other role is resolved via its DB role → permissions mapping.
 */
export async function can(
  user: AuthUser,
  permission: PermissionCode,
): Promise<boolean> {
  if (user.isPlatformAdmin) return true;
  if (!user.roleId) return false;
  const { code, permissions } = await loadRole(user.roleId);
  if (!code) return false;
  return permissions.has(permission);
}

/**
 * Synchronous variant for client-side UI decisions only. Real enforcement
 * always happens server-side via `can()`.
 */
export function canSync(
  roleCode: string | undefined,
  permission: PermissionCode,
  isPlatformAdmin = false,
): boolean {
  if (isPlatformAdmin) return true;
  if (!roleCode) return false;
  if (roleCode === "owner") return true;
  const grants =
    ROLE_PERMISSIONS[roleCode as RoleCode] ?? undefined;
  if (!grants) return false;
  return grants.includes(permission);
}