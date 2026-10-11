"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveProduct, type ActionState } from "@/app/[locale]/(app)/products/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils";

type Option = { id: string; nameEn: string; nameAr: string | null };

export type ProductFormValues = {
  id?: string;
  nameEn: string;
  nameAr: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  brandId: string | null;
  supplierId: string | null;
  cost: string;
  price: string;
  compareAtPrice: string;
  gender: string;
  season: string | null;
  material: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  status: string;
  isActive: boolean;
};

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </select>
  );
}

export function ProductForm({
  product,
  categories,
  brands,
  suppliers,
}: {
  product?: ProductFormValues;
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [state, action] = useActionState<ActionState, FormData>(saveProduct, undefined);

  return (
    <form action={action} className="flex flex-col gap-6">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error === "skuTaken" ? t("sku") + " — " + tc("required") : tc("required")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nameEn">{t("nameEn")}</Label>
            <Input id="nameEn" name="nameEn" defaultValue={product?.nameEn ?? ""} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nameAr">{t("nameAr")}</Label>
            <Input id="nameAr" name="nameAr" defaultValue={product?.nameAr ?? ""} required dir="rtl" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sku">{t("sku")}</Label>
            <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} required className="font-mono" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="barcode">{t("barcode")}</Label>
            <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} className="font-mono" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">{t("category")}</Label>
            <Select name="categoryId" defaultValue={product?.categoryId}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brandId">{t("brand")}</Label>
            <Select name="brandId" defaultValue={product?.brandId}>
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameEn}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplierId">{t("supplier")}</Label>
            <Select name="supplierId" defaultValue={product?.supplierId}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gender">{t("gender")}</Label>
            <Select name="gender" defaultValue={product?.gender ?? "UNISEX"}>
              <option value="UNISEX">Unisex</option>
              <option value="MEN">Men</option>
              <option value="WOMEN">Women</option>
              <option value="KIDS">Kids</option>
              <option value="BABY">Baby</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost">{t("cost")}</Label>
            <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue={product?.cost ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">{t("price")}</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={product?.price ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="compareAtPrice">{t("compareAt")}</Label>
            <Input id="compareAtPrice" name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={product?.compareAtPrice ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season">{t("season")}</Label>
            <Input id="season" name="season" defaultValue={product?.season ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="material">{t("material")}</Label>
            <Input id="material" name="material" defaultValue={product?.material ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">{t("status")}</Label>
            <Select name="status" defaultValue={product?.status ?? "ACTIVE"}>
              <option value="ACTIVE">{t("active")}</option>
              <option value="DRAFT">{t("draft")}</option>
              <option value="ARCHIVED">{t("archived")}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="descriptionEn">{t("descriptionEn")}</Label>
            <Textarea id="descriptionEn" name="descriptionEn" defaultValue={product?.descriptionEn ?? ""} rows={2} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="descriptionAr">{t("descriptionAr")}</Label>
            <Textarea id="descriptionAr" name="descriptionAr" defaultValue={product?.descriptionAr ?? ""} rows={2} dir="rtl" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="size-4 rounded border-input" />
            {tc("active")}
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
