"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  saveExpense,
  type ActionState,
} from "@/app/[locale]/(app)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { useCloseOnSuccess } from "@/components/shared/use-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type Branch = { id: string; nameAr: string; nameEn: string };
type Category = { id: string; nameAr: string; nameEn: string };

export type ExpenseValues = {
  id?: string;
  branchId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  expenseDate: string;
  paymentMethod: string;
  notes: string | null;
};

export function ExpenseFormDialog({
  branches,
  categories,
  expense,
  trigger,
}: {
  branches: Branch[];
  categories: Category[];
  expense?: ExpenseValues;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(saveExpense, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    } else if (state?.error) {
      toast.error(tc("required"));
    }
  }, [state, t, tc]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            {t("new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          {expense?.id && <input type="hidden" name="id" value={expense.id} />}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="e-desc">{t("description")}</Label>
            <Input id="e-desc" name="description" defaultValue={expense?.description ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-amount">{t("amount")}</Label>
            <Input id="e-amount" name="amount" type="number" step="0.01" min="0" defaultValue={expense?.amount ?? ""} required dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-date">{t("date")}</Label>
            <Input id="e-date" name="expenseDate" type="date" defaultValue={expense?.expenseDate ?? new Date().toISOString().slice(0, 10)} required dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-branch">{t("branch")}</Label>
            <select
              id="e-branch"
              name="branchId"
              defaultValue={expense?.branchId ?? branches[0]?.id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-category">{t("category")}</Label>
            <select
              id="e-category"
              name="categoryId"
              defaultValue={expense?.categoryId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-method">{t("paymentMethod")}</Label>
            <select
              id="e-method"
              name="paymentMethod"
              defaultValue={expense?.paymentMethod ?? "CASH"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="CASH">CASH</option>
              <option value="CARD">CARD</option>
              <option value="MOBILE_WALLET">MOBILE_WALLET</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="e-notes">{tc("notes")}</Label>
            <Textarea id="e-notes" name="notes" rows={2} defaultValue={expense?.notes ?? ""} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
