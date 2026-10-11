"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navGroups } from "./nav";
import { NAV_ICONS } from "./nav-icons";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const flat = navGroups.flatMap((g) =>
      g.items.map((i) => ({ ...i, group: g.key })),
    );
    if (!q) return flat;
    return flat.filter((i) => t(i.key).toLowerCase().includes(q));
  }, [query, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[20%] max-w-lg translate-y-0 gap-0 p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("globalSearch")}</DialogTitle>
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="flex flex-col"
        >
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("globalSearch")}
              className="h-12 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </p>
            )}
            {results.map((item) => {
              const Icon = NAV_ICONS[item.iconKey];
              return (
                <Link
                  key={item.key}
                  href={item.href as Route}
                  onClick={() => {
                    setQuery("");
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}