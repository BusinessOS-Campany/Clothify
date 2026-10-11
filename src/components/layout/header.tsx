"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useAppPreferences } from "@/components/providers/app-preferences";
import { signOut } from "@/core/auth/client";
import type { SessionUser } from "@/core/auth/session";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandMenu } from "./command-menu";
import { LanguageSwitcher } from "./language-switcher";
import { BranchSelector } from "./branch-selector";
import type { AppNotification, BranchOption } from "./types";
import { findNavHref } from "./nav";

export function Header({
  user,
  onMenuClick,
  branches,
  notifications,
}: {
  user: SessionUser;
  onMenuClick: () => void;
  branches: BranchOption[];
  notifications: AppNotification[];
}) {
  const t = useTranslations("nav");
  const tu = useTranslations("user");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppPreferences();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const currentHref = findNavHref(pathname ?? "/");

  const initials = useMemo(() => {
    const parts = (user.name || "?").trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? "?";
    const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
    return `${first}${last}`.toUpperCase();
  }, [user.name]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackURL: "/login" });
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label={t("openMenu")}
      >
        <Menu className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={
          sidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")
        }
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="size-5" />
        ) : (
          <PanelLeftClose className="size-5" />
        )}
      </Button>

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{t("dashboard")}</BreadcrumbLink>
          </BreadcrumbItem>
          {currentHref && currentHref !== "/" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t(currentHref.slice(1))}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      <BranchSelector branches={branches} />

      <Button
        variant="outline"
        size="sm"
        className="hidden gap-2 text-muted-foreground md:flex md:w-56 md:justify-start"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">{t("globalSearch")}</span>
        <kbd className="ms-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </Button>

      <div className="flex gap-1 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(true)}
          aria-label={t("globalSearch")}
        >
          <Search className="size-5" />
        </Button>
      </div>

      <LanguageSwitcher />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label={tc("toggleTheme")}
      >
        <Sun className="hidden size-5 dark:block" />
        <Moon className="size-5 dark:hidden" />
      </Button>

      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t("notifications")}
          >
            <Bell className="size-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 end-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {notifications.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="text-center">
            {t("notifications")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-sm text-muted-foreground">{tc("allClear")}</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1">
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  asChild={!!n.href}
                  onSelect={() => setNotifOpen(false)}
                >
                  {n.href ? (
                    <a href={n.href} className="w-full items-start gap-2 py-2">
                      <NoticeDot tone={n.tone} />
                      <span className="text-sm">{n.text}</span>
                    </a>
                  ) : (
                    <span className="flex w-full items-start gap-2 py-2">
                      <NoticeDot tone={n.tone} />
                      <span className="text-sm">{n.text}</span>
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-start md:block">
              <span className="block max-w-36 truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="block max-w-36 truncate text-xs text-muted-foreground">
                {tu("role")}
              </span>
            </span>
            <ChevronsUpDown className="hidden size-4 text-muted-foreground md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="size-4" /> {tc("settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              void handleSignOut();
            }}
            disabled={signingOut}
          >
            <LogOut className="size-4" /> {tc("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

function NoticeDot({
  tone,
}: {
  tone?: AppNotification["tone"];
}) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2 shrink-0 rounded-full",
        tone === "danger" && "bg-destructive",
        tone === "warning" && "bg-warning",
        tone === "success" && "bg-success",
        (!tone || tone === "default") && "bg-primary",
      )}
    />
  );
}