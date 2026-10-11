"use client";

import { useActionState, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  createPurchaseOrder,
  type ActionState,
} from "@/app/[locale]/(app)/purchasing/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { fmtMoney } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

type Branch = { id: string; nameAr: string; nameEn: string };
type Supplier = { id: string; name: string };
type Variant = { id: string; label: string; sku: string; cost: number };
type Line = { key: string; variantId: string; quantity: number; unitCost: number };

let seq = 0;
const nextKey = () => `l${++seq}`;

export function PurchaseOrderBuilder({
  branches,
  suppliers,
  variants,
}: {
  branches: Branch[];
  suppliers: Supplier[];
  variants: Variant[];
}) {
  const t = useTranslations("purchasing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action] = useActionState<ActionState, FormData>(
    createPurchaseOrder,
    undefined,
  );
  const [lines, setLines] = useState<Line[]>([{ key: nextKey(), variantId: "", quantity: 1, unitCost: 0 }]);

  const validLines = lines.filter((l) => l.variantId && l.quantity > 0);
  const subtotal = validLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  function update(key: string, patch: Partial<Line>) {
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error === "empty" ? t("emptyHint") : tc("required")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("newPo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplierId">{t("supplier")}</Label>
            <select
              id="supplierId"
              name="supplierId"
              required
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">{t("selectSupplierFirst")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="branchId">{t("branch")}</Label>
            <select
              id="branchId"
              name="branchId"
              required
              defaultValue={branches[0]?.id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expectedDeliveryDate">{t("expectedDate")}</Label>
            <Input id="expectedDeliveryDate" name="expectedDeliveryDate" type="date" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{t("orderedQty")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((l) => [...l, { key: nextKey(), variantId: "", quantity: 1, unitCost: 0 }])}
          >
            <Plus />
            {tc("add")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-xs">{t("selectSupplierFirst")}</Label>
                <select
                  value={line.variantId}
                  onChange={(e) => {
                    const v = variants.find((x) => x.id === e.target.value);
                    update(line.key, { variantId: e.target.value, unitCost: v?.cost ?? 0 });
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">—</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} ({v.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <Label className="text-xs">{t("orderedQty")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => update(line.key, { quantity: Number(e.target.value) })}
                  dir="ltr"
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">{t("unitCost")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) => update(line.key, { unitCost: Number(e.target.value) })}
                  dir="ltr"
                />
              </div>
              <div className="w-24 pb-2 text-end text-sm" dir="ltr">
                {fmtMoney(line.quantity * line.unitCost)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setLines((l) => (l.length > 1 ? l.filter((x) => x.key !== line.key) : l))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{tc("notes")}</Label>
        <Input id="notes" name="notes" />
      </div>

      <input
        type="hidden"
        name="items"
        value={JSON.stringify(validLines.map(({ variantId, quantity, unitCost }) => ({ variantId, quantity, unitCost })))}
      />

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">{t("orderTotal")}: </span>
          <span className="font-semibold" dir="ltr">{fmtMoney(subtotal)}</span>
        </div>
        <SubmitButton pendingLabel={tc("saving")}>{t("newPo")}</SubmitButton>
      </div>
    </form>
  );
}
