"use client";

import { useActionState, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  createTransfer,
  type ActionState,
} from "@/app/[locale]/(app)/inventory/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Plus, Trash2 } from "lucide-react";

export type VariantOption = { id: string; label: string; sku: string };
type Branch = { id: string; nameAr: string; nameEn: string };
type Line = { key: string; variantId: string; quantity: number };

let seq = 0;
const nextKey = () => `l${++seq}`;

export function TransferBuilder({
  branches,
  variants,
}: {
  branches: Branch[];
  variants: VariantOption[];
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action] = useActionState<ActionState, FormData>(createTransfer, undefined);
  const [lines, setLines] = useState<Line[]>([{ key: nextKey(), variantId: "", quantity: 1 }]);

  function addLine() {
    setLines((l) => [...l, { key: nextKey(), variantId: "", quantity: 1 }]);
  }
  function removeLine(key: string) {
    setLines((l) => (l.length > 1 ? l.filter((x) => x.key !== key) : l));
  }
  function update(key: string, patch: Partial<Line>) {
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  const validLines = lines.filter((l) => l.variantId && l.quantity > 0);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error === "sameBranch"
            ? t("sameBranch")
            : state.error === "noItems"
              ? t("noItems")
              : tc("required")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("transfers")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fromBranchId">{t("fromBranch")}</Label>
            <select
              id="fromBranchId"
              name="fromBranchId"
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
            <Label htmlFor="toBranchId">{t("toBranch")}</Label>
            <select
              id="toBranchId"
              name="toBranchId"
              required
              defaultValue={branches[1]?.id ?? branches[0]?.id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{t("items")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus />
            {t("addLine")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-xs">{t("selectVariant")}</Label>
                <select
                  value={line.variantId}
                  onChange={(e) => update(line.key, { variantId: e.target.value })}
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
              <div className="flex w-24 flex-col gap-1.5">
                <Label className="text-xs">{t("quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => update(line.key, { quantity: Number(e.target.value) })}
                  dir="ltr"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => removeLine(line.key)}
                aria-label={tc("delete")}
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

      <input type="hidden" name="items" value={JSON.stringify(validLines.map(({ variantId, quantity }) => ({ variantId, quantity })))} />

      <div className="flex justify-end gap-2">
        <SubmitButton pendingLabel={tc("saving")}>{t("createTransfer")}</SubmitButton>
      </div>
    </form>
  );
}
