import type { PermissionCode } from "@/core/rbac/catalog";

export type IconKey =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "sales"
  | "customers"
  | "suppliers"
  | "purchasing"
  | "expenses"
  | "employees"
  | "branches"
  | "reports"
  | "subscription"
  | "settings";

export type NavItem = {
  key: string;
  href: string;
  iconKey: IconKey;
  permission?: PermissionCode;
};

export type NavGroup = {
  key: "main" | "sell" | "operations" | "admin";
  items: NavItem[];
};

/**
 * Sidebar navigation. Items are added here as modules ship; every item must
 * resolve to a functional, permission-protected page. Icons are resolved
 * client-side from `iconKey` (see nav-icons.ts).
 */
export const navGroups: NavGroup[] = [
  {
    key: "main",
    items: [
      { key: "dashboard", href: "/", iconKey: "dashboard" },
      { key: "pos", href: "/pos", iconKey: "pos", permission: "pos:read" },
      { key: "sales", href: "/sales", iconKey: "sales", permission: "sales:read" },
      { key: "customers", href: "/customers", iconKey: "customers", permission: "customers:read" },
    ],
  },
  {
    key: "sell",
    items: [
      { key: "products", href: "/products", iconKey: "products", permission: "products:read" },
      { key: "inventory", href: "/inventory", iconKey: "inventory", permission: "inventory:read" },
      { key: "purchasing", href: "/purchasing", iconKey: "purchasing", permission: "purchasing:read" },
      { key: "suppliers", href: "/suppliers", iconKey: "suppliers", permission: "suppliers:read" },
      { key: "expenses", href: "/expenses", iconKey: "expenses", permission: "expenses:read" },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "employees", href: "/employees", iconKey: "employees", permission: "employees:read" },
      { key: "branches", href: "/branches", iconKey: "branches", permission: "branches:read" },
      { key: "reports", href: "/reports", iconKey: "reports", permission: "reports:read" },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "subscription", href: "/subscription", iconKey: "subscription", permission: "subscription:read" },
      { key: "settings", href: "/settings", iconKey: "settings", permission: "settings:read" },
    ],
  },
];

export function findNavHref(pathname: string): string | undefined {
  const normalized = pathname.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
  let best: string | undefined;
  let bestLen = 0;
  for (const group of navGroups) {
    for (const item of group.items) {
      if (normalized === item.href) return item.href;
      if (normalized.startsWith(item.href) && item.href.length > bestLen) {
        best = item.href;
        bestLen = item.href.length;
      }
    }
  }
  return best;
}