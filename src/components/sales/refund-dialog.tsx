"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  processRefund,
  type ActionState,
} from "@/app/[locale]/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/format";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

export type RefundableItem = {
  saleItemId: string;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  returnedQty: number;
};

export function RefundDialog({
  saleId,
  items,
}: {
  saleId: string;
  items: RefundableItem[];
}) {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [condition, setCondition] = useState<Record<string, string>>({});
  const [state, action] = useActionState<ActionState, FormData>(processRefund, undefined);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error === "alreadyReturned" ? t("alreadyReturned") : tc("required"));
    }
  }, [state, t, tc]);

  const refundable = items.filter((i) => i.quantity - i.returnedQty > 0);

  const lines = refundable
    .map((i) => ({
      saleItemId: i.saleItemId,
      quantity: Math.min(qty[i.saleItemId] ?? 0, i.quantity - i.returnedQty),
      condition: condition[i.saleItemId] ?? "RESELLABLE",
    }))
    .filter((l) => l.quantity > 0);
  const refundTotal = lines.reduce((s, l) => {
    const it = refundable.find((i) => i.saleItemId === l.saleItemId)!;
    return s + it.unitPrice * l.quantity;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="size-4" />
          {t("refundSale")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("refundSale")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="items" value={JSON.stringify(lines)} />

          {refundable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("alreadyReturned")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {refundable.map((i) => (
                <div key={i.saleItemId} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.variantLabel ?? ""} · {fmtMoney(i.unitPrice)} ·{" "}
                      {t("refundQty")}: {i.quantity - i.returnedQty}
                    </p>
                  </div>
                  <div className="w-20">
                    <Label className="text-[10px]">{t("refundQty")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={i.quantity - i.returnedQty}
                      value={qty[i.saleItemId] ?? 0}
                      onChange={(e) => setQty((q) => ({ ...q, [i.saleItemId]: Number(e.target.value) }))}
                      dir="ltr"
                      className="h-8"
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-[10px]">{t("condition")}</Label>
                    <select
                      value={condition[i.saleItemId] ?? "RESELLABLE"}
                      onChange={(e) => setCondition((c) => ({ ...c, [i.saleItemId]: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                    >
                      <option value="RESELLABLE">{t("resellable")}</option>
                      <option value="DAMAGED">{t("damaged")}</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-reason" className="text-xs">
              {t("refundReason")}
            </Label>
            <Input id="refund-reason" name="reason" />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">{t("refundTotal")}</span>
            <span className="font-semibold" dir="ltr">
              {fmtMoney(refundTotal)}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={tc("saving")} disabled={lines.length === 0}>
              {t("processRefund")}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
