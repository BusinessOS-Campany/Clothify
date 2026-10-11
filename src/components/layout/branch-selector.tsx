"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BranchOption } from "./types";

const BRANCH_KEY = "clothify-branch-id";

export function getPersistedBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRANCH_KEY);
}

export function BranchSelector({
  branches,
}: {
  branches: BranchOption[];
}) {
  const t = useTranslations("nav");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getPersistedBranchId();
    const valid = stored && branches.some((b) => b.id === stored);
    // localStorage is only readable after mount; syncing to it here is required.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(valid ? stored : (branches[0]?.id ?? null));
  }, [branches]);

  const selected = branches.find((b) => b.id === selectedId) ?? branches[0];

  if (branches.length <= 1) {
    return branches.length === 1 ? (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Store className="size-3.5" />
        <span className="hidden sm:inline">{selected?.nameEn}</span>
      </div>
    ) : null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <Store className="size-3.5" />
          <span className="max-w-32 truncate">
            {selected?.nameEn ?? t("branch")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("selectBranch")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => {
              setSelectedId(b.id);
              window.localStorage.setItem(BRANCH_KEY, b.id);
            }}
            className="justify-between"
          >
            <span>{b.nameEn}</span>
            <span className="text-xs text-muted-foreground">{b.code}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useSelectedBranch(branches: BranchOption[]): BranchOption | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const stored = getPersistedBranchId();
    // localStorage is only readable after mount; syncing to it here is required.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setId(stored && branches.some((b) => b.id === stored) ? stored : null);
    const onStorage = () => {
      const v = getPersistedBranchId();
      setId(v && branches.some((b) => b.id === v) ? v : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [branches]);
  return branches.find((b) => b.id === id) ?? branches[0] ?? null;
}