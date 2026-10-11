"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adjustStockAction,
  type ActionState,
} from "@/app/[locale]/(app)/inventory/actions";
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
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

export function AdjustStockDialog({
  branchId,
  variantId,
  label,
  currentQty,
}: {
  branchId: string;
  variantId: string;
  label: string;
  currentQty: number;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    adjustStockAction,
    undefined,
  );
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("adjusted"));
    } else if (state?.error) {
      toast.error(state.error === "insufficient" ? t("insufficient") : tc("required"));
    }
  }, [state, t, tc]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("adjust")}>
          <SlidersHorizontal className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("adjust")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="branchId" value={branchId} />
          <input type="hidden" name="variantId" value={variantId} />
          <p className="text-sm text-muted-foreground">
            {label} · {t("balance")}: <span dir="ltr">{currentQty}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`delta-${variantId}`} className="text-xs">
              {t("delta")} (+/−)
            </Label>
            <Input
              id={`delta-${variantId}`}
              name="delta"
              type="number"
              step="1"
              required
              dir="ltr"
              placeholder="+5 / -3"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reason-${variantId}`} className="text-xs">
              {t("adjustmentReason")}
            </Label>
            <select
              id={`reason-${variantId}`}
              name="reason"
              defaultValue="adjust"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="adjust">{t("adjustment")}</option>
              <option value="damage">{t("damaged")}</option>
              <option value="return">{t("returned")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`notes-${variantId}`} className="text-xs">
              {tc("notes")}
            </Label>
            <Input id={`notes-${variantId}`} name="notes" />
          </div>
          <div className="flex justify-end gap-2">
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
