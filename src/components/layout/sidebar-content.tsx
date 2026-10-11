"use client";

import type { Route } from "next";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavGroup } from "./nav";
import { NAV_ICONS } from "./nav-icons";
import type { SessionUser } from "@/core/auth/session";

export function SidebarContent({
  groups,
  collapsed,
  onNavigate,
  footer,
}: {
  groups: NavGroup[];
  collapsed?: boolean;
  user: SessionUser;
  onNavigate?: () => void;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div
          className={cn(
            "flex items-center gap-3 border-b border-sidebar-border px-4 py-4",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <BrandMark />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold">{tc("appName")}</p>
              <p className="text-xs text-muted-foreground">
                {tc("tagline")}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.key}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-sidebar-foreground/45 uppercase">
                  {t(group.key)}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.iconKey];
                  const active = isActive(item.href);
                  const content = (
                    <Link
                      href={item.href as Route}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && (
                        <span className="truncate">{t(item.key)}</span>
                      )}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={item.key}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right">
                        {t(item.key)}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <li key={item.key}>{content}</li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {footer}
      </div>
    </TooltipProvider>
  );
}