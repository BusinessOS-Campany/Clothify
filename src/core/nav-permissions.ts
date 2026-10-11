import { navGroups, type NavGroup } from "@/components/layout/nav";
import { can } from "@/core/rbac";
import type { AuthUserShape } from "@/core/nav-types";

/** Filters navigation to what the user is actually permitted to open. */
export async function filterNav(user: AuthUserShape): Promise<NavGroup[]> {
  const out: NavGroup[] = [];
  for (const group of navGroups) {
    const items: NavGroup["items"] = [];
    for (const item of group.items) {
      if (!item.permission || (await can(user, item.permission))) {
        items.push(item);
      }
    }
    if (items.length > 0) out.push({ ...group, items });
  }
  return out;
}