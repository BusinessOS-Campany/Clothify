"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAppPreferences } from "@/components/providers/app-preferences";
import type { NavGroup } from "./nav";
import type { SessionUser } from "@/core/auth/session";
import { SidebarContent } from "./sidebar-content";
import { Header } from "./header";
import type { AppNotification, BranchOption } from "./types";

export function AppShell({
  children,
  groups,
  user,
  branches,
  notifications,
}: {
  children: React.ReactNode;
  groups: NavGroup[];
  user: SessionUser;
  branches: BranchOption[];
  notifications: AppNotification[];
}) {
  const { sidebarCollapsed } = useAppPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      <aside
        data-collapsed={sidebarCollapsed}
        className="sticky top-0 hidden h-svh shrink-0 overflow-hidden border-e border-sidebar-border lg:block"
      >
        <motion.div
          className="h-full"
          animate={{ width: sidebarCollapsed ? "4rem" : "16rem" }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <SidebarContent
            groups={groups}
            collapsed={sidebarCollapsed}
            user={user}
          />
        </motion.div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-e border-sidebar-border bg-sidebar p-0"
        >
          <SidebarContent
            groups={groups}
            user={user}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          onMenuClick={() => setMobileOpen(true)}
          branches={branches}
          notifications={notifications}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}