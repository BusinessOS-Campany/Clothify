"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  receiveGoods,
  type ActionState,
} from "@/app/[locale]/(app)/purchasing/actions";
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
import { fmtMoney } from "@/lib/format";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

export type ReceivableItem = {
  poItemId: string;
  name: string;
  variantLabel: string | null;
  unitCost: number;
  quantity: number;
  receivedQuantity: number;
};

export function ReceiveGoodsDialog({
  poId,
  items,
}: {
  poId: string;
  items: ReceivableItem[];
}) {
  const t = useTranslations("purchasing");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, action] = useActionState<ActionState, FormData>(receiveGoods, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("receiptCreated"));
    } else if (state?.error) {
      toast.error(tc("required"));
    }
  }, [state, t, tc]);

  const pending = items.filter((i) => i.quantity - i.receivedQuantity > 0);
  const lines = pending
    .map((i) => ({
      poItemId: i.poItemId,
      quantity: Math.min(qty[i.poItemId] ?? i.quantity - i.receivedQuantity, i.quantity - i.receivedQuantity),
    }))
    .filter((l) => l.quantity > 0);
  const total = lines.reduce((s, l) => {
    const it = pending.find((i) => i.poItemId === l.poItemId)!;
    return s + it.unitCost * l.quantity;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackageCheck className="size-4" />
          {t("receiveGoods")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("receiveGoods")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="poId" value={poId} />
          <input type="hidden" name="items" value={JSON.stringify(lines)} />
          <p className="text-sm text-muted-foreground">{t("receiveHint")}</p>

          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("received")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((i) => (
                <div key={i.poItemId} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.variantLabel ?? ""} · {fmtMoney(i.unitCost)} ·{" "}
                      {t("orderedQty")}: {i.quantity - i.receivedQuantity}
                    </p>
                  </div>
                  <div className="w-24">
                    <Label className="text-[10px]">{t("receive")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={i.quantity - i.receivedQuantity}
                      value={qty[i.poItemId] ?? i.quantity - i.receivedQuantity}
                      onChange={(e) => setQty((q) => ({ ...q, [i.poItemId]: Number(e.target.value) }))}
                      dir="ltr"
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receive-notes" className="text-xs">
              {tc("notes")}
            </Label>
            <Input id="receive-notes" name="notes" />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">{t("lineTotal")}</span>
            <span className="font-semibold" dir="ltr">{fmtMoney(total)}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={tc("saving")} disabled={lines.length === 0}>
              {t("confirmReceipt")}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
