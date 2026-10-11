"use client";

import { useTranslations } from "next-intl";
import { deleteExpense } from "@/app/[locale]/(app)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteExpenseButton({ id }: { id: string }) {
  const t = useTranslations("common");
  return (
    <form action={deleteExpense}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        title={t("delete")}
        onClick={(e) => {
          if (!confirm(t("delete") + "?")) e.preventDefault();
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
