"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "balances", href: "/inventory" },
  { key: "movements", href: "/inventory/movements" },
  { key: "transfers", href: "/inventory/transfers" },
  { key: "stocktake", href: "/inventory/stocktake" },
] as const;

export function InventoryTabs() {
  const t = useTranslations("inventory");
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/inventory"
      ? pathname === "/inventory"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active(tab.href)
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(tab.key)}
        </Link>
      ))}
    </div>
  );
}
