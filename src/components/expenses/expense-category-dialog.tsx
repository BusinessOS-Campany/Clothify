"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveExpenseCategory,
  type ActionState,
} from "@/app/[locale]/(app)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { useCloseOnSuccess } from "@/components/shared/use-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

export function ExpenseCategoryDialog() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(saveExpenseCategory, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    }
  }, [state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" />
          {t("category")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("category")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-nameEn">Name (EN)</Label>
            <Input id="c-nameEn" name="nameEn" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-nameAr">Name (AR)</Label>
            <Input id="c-nameAr" name="nameAr" required dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-color">Color</Label>
            <Input id="c-color" name="color" type="color" defaultValue="#64748b" className="h-9 w-20 p-1" />
          </div>
          <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
