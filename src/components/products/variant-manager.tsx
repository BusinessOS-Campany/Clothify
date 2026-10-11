"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveVariant,
  deleteVariant,
  type ActionState,
} from "@/app/[locale]/(app)/products/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { useCloseOnSuccess } from "@/components/shared/use-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney } from "@/lib/format";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type VariantRow = {
  id: string;
  sku: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  price: string;
  cost: string;
  isActive: boolean;
  stock: number;
};

export function VariantManager({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantRow[];
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const addFormRef = useRef<HTMLFormElement>(null);
  const [addState, addAction] = useActionState<ActionState, FormData>(
    saveVariant,
    undefined,
  );

  useEffect(() => {
    if (addState?.ok) {
      addFormRef.current?.reset();
      toast.success(t("saved"));
    } else if (addState?.error) {
      toast.error(tc("required"));
    }
  }, [addState, t, tc]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t("variants")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          ref={addFormRef}
          action={addAction}
          className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-6"
        >
          <input type="hidden" name="productId" value={productId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color" className="text-xs">
              {t("color")}
            </Label>
            <Input id="color" name="color" placeholder="Black" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="size" className="text-xs">
              {t("size")}
            </Label>
            <Input id="size" name="size" placeholder="M" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-sku" className="text-xs">
              {t("variantSku")}
            </Label>
            <Input id="v-sku" name="sku" className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-price" className="text-xs">
              {t("price")}
            </Label>
            <Input id="v-price" name="price" type="number" step="0.01" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-cost" className="text-xs">
              {t("cost")}
            </Label>
            <Input id="v-cost" name="cost" type="number" step="0.01" dir="ltr" />
          </div>
          <div className="flex items-end">
            <SubmitButton size="sm" className="w-full">
              <Plus />
              {t("addVariant")}
            </SubmitButton>
          </div>
        </form>

        {variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("noVariants")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("variantSku")}</TableHead>
                  <TableHead>{t("color")}</TableHead>
                  <TableHead>{t("size")}</TableHead>
                  <TableHead className="text-end">{t("price")}</TableHead>
                  <TableHead className="text-end">{t("cost")}</TableHead>
                  <TableHead className="text-end">{t("stock")}</TableHead>
                  <TableHead className="text-end">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                    <TableCell>{v.color ?? "—"}</TableCell>
                    <TableCell>{v.size ?? "—"}</TableCell>
                    <TableCell className="text-end" dir="ltr">
                      {fmtMoney(v.price)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground" dir="ltr">
                      {fmtMoney(v.cost)}
                    </TableCell>
                    <TableCell className="text-end" dir="ltr">
                      {v.stock}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <VariantDialog productId={productId} variant={v} />
                        <form action={deleteVariant}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="productId" value={productId} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label={tc("delete")}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VariantDialog({
  productId,
  variant,
}: {
  productId: string;
  variant: VariantRow;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    saveVariant,
    undefined,
  );
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    }
  }, [state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tc("edit")}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={variant.id} />
          <input type="hidden" name="productId" value={productId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`c-${variant.id}`} className="text-xs">
              {t("color")}
            </Label>
            <Input id={`c-${variant.id}`} name="color" defaultValue={variant.color ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`s-${variant.id}`} className="text-xs">
              {t("size")}
            </Label>
            <Input id={`s-${variant.id}`} name="size" defaultValue={variant.size ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`k-${variant.id}`} className="text-xs">
              {t("variantSku")}
            </Label>
            <Input id={`k-${variant.id}`} name="sku" defaultValue={variant.sku} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`b-${variant.id}`} className="text-xs">
              {t("barcode")}
            </Label>
            <Input id={`b-${variant.id}`} name="barcode" defaultValue={variant.barcode ?? ""} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`p-${variant.id}`} className="text-xs">
              {t("price")}
            </Label>
            <Input id={`p-${variant.id}`} name="price" type="number" step="0.01" defaultValue={variant.price} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`co-${variant.id}`} className="text-xs">
              {t("cost")}
            </Label>
            <Input id={`co-${variant.id}`} name="cost" type="number" step="0.01" defaultValue={variant.cost} dir="ltr" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked={variant.isActive} className="size-4 rounded border-input" />
            {tc("active")}
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
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
