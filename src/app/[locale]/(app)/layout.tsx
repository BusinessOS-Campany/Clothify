import { requireTenant } from "@/core/auth/session";
import { resolveRoleId } from "@/core/auth/session";
import { filterNav } from "@/core/nav-permissions";
import { getBranchOptions, getNotifications } from "@/core/notifications";
import { AppShell } from "@/components/layout/app-shell";
import { getLocale } from "next-intl/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTenant();
  const roleId = await resolveRoleId(user);
  const locale = await getLocale();
  const [groups, branches, notifications] = await Promise.all([
    filterNav({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }),
    getBranchOptions(),
    getNotifications(locale),
  ]);

  return (
    <AppShell
      groups={groups}
      user={user}
      branches={branches}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}