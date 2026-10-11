"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  updateStoreProfile,
  updateTaxSettings,
  updateInventorySettings,
  updateReceiptSettings,
  type ActionState,
} from "@/app/[locale]/(app)/settings/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import type { StoreConfig } from "@/lib/store-config";
import { toast } from "sonner";

export type TenantValues = {
  nameEn: string;
  nameAr: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  vatNumber: string | null;
  logoUrl: string | null;
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  locale: string;
};

function useSavedToast(state: ActionState) {
  const tc = useTranslations("common");
  const t = useTranslations("settings");
  useEffect(() => {
    if (state?.ok) toast.success(t("saved"));
    else if (state?.error === "forbidden") toast.error(tc("required"));
    else if (state?.error) toast.error(tc("required"));
  }, [state, t, tc]);
}

export function SettingsForm({
  tenant,
  config,
}: {
  tenant: TenantValues;
  config: StoreConfig;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const [storeState, storeAction] = useActionState<ActionState, FormData>(updateStoreProfile, undefined);
  const [taxState, taxAction] = useActionState<ActionState, FormData>(updateTaxSettings, undefined);
  const [invState, invAction] = useActionState<ActionState, FormData>(updateInventorySettings, undefined);
  const [rcptState, rcptAction] = useActionState<ActionState, FormData>(updateReceiptSettings, undefined);
  useSavedToast(storeState);
  useSavedToast(taxState);
  useSavedToast(invState);
  useSavedToast(rcptState);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("store")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={storeAction} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-nameEn">{t("storeNameEn")}</Label>
              <Input id="s-nameEn" name="nameEn" defaultValue={tenant.nameEn} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-nameAr">{t("storeNameAr")}</Label>
              <Input id="s-nameAr" name="nameAr" defaultValue={tenant.nameAr} required dir="rtl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-phone">{t("phone")}</Label>
              <Input id="s-phone" name="phone" defaultValue={tenant.phone ?? ""} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-email">{t("email")}</Label>
              <Input id="s-email" name="email" type="email" defaultValue={tenant.email ?? ""} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="s-address">{t("address")}</Label>
              <Input id="s-address" name="address" defaultValue={tenant.address ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-vat">{t("vatNumber")}</Label>
              <Input id="s-vat" name="vatNumber" defaultValue={tenant.vatNumber ?? ""} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-logo">{t("logoUrl")}</Label>
              <Input id="s-logo" name="logoUrl" defaultValue={tenant.logoUrl ?? ""} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-currency">{t("currency")}</Label>
              <Input id="s-currency" name="currency" defaultValue={tenant.currency} required dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-symbol">{t("currencySymbol")}</Label>
              <Input id="s-symbol" name="currencySymbol" defaultValue={tenant.currencySymbol} required dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-tz">{t("timezone")}</Label>
              <Input id="s-tz" name="timezone" defaultValue={tenant.timezone} required dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-date">{t("dateFormat")}</Label>
              <select
                id="s-date"
                name="dateFormat"
                defaultValue={tenant.dateFormat}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                dir="ltr"
              >
                <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-locale">{t("locale")}</Label>
              <select
                id="s-locale"
                name="locale"
                defaultValue={tenant.locale}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel={tc("saving")}>{t("saveStore")}</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("tax")}</CardTitle>
          <CardDescription>{t("discounts")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={taxAction} className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="taxEnabled" value="true" defaultChecked={config.taxEnabled} />
              {t("taxEnabled")}
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-rate">{t("taxRate")}</Label>
              <Input id="t-rate" name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={config.taxRate} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-nameEn">{t("taxNameEn")}</Label>
              <Input id="t-nameEn" name="taxNameEn" defaultValue={config.taxNameEn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-nameAr">{t("taxNameAr")}</Label>
              <Input id="t-nameAr" name="taxNameAr" defaultValue={config.taxNameAr} dir="rtl" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="discountEnabled" value="true" defaultChecked={config.discountEnabled} />
              {t("discountEnabled")}
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-maxdisc">{t("maxDiscountPercent")}</Label>
              <Input id="t-maxdisc" name="maxDiscountPercent" type="number" min="0" max="100" defaultValue={config.maxDiscountPercent} dir="ltr" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="enableLoyalty" value="true" defaultChecked={config.enableLoyalty} />
              {t("enableLoyalty")}
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-loyalty">{t("loyaltyPointsPerMoney")}</Label>
              <Input id="t-loyalty" name="loyaltyPointsPerMoney" type="number" step="0.01" min="0" defaultValue={config.loyaltyPointsPerMoney} dir="ltr" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel={tc("saving")}>{t("saveTax")}</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("inventoryRules")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={invAction} className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="allowNegativeInventory" value="true" defaultChecked={config.allowNegativeInventory} />
              {t("allowNegativeInventory")}
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-threshold">{t("lowStockThreshold")}</Label>
              <Input id="i-threshold" name="lowStockThreshold" type="number" min="0" defaultValue={config.lowStockThreshold} dir="ltr" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("allowNegativeHint")}</p>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel={tc("saving")}>{t("saveInventory")}</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("receipt")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={rcptAction} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-headEn">{t("receiptHeaderEn")}</Label>
              <Textarea id="r-headEn" name="receiptHeaderEn" rows={2} defaultValue={config.receiptHeaderEn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-headAr">{t("receiptHeaderAr")}</Label>
              <Textarea id="r-headAr" name="receiptHeaderAr" rows={2} defaultValue={config.receiptHeaderAr} dir="rtl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-footEn">{t("receiptFooterEn")}</Label>
              <Textarea id="r-footEn" name="receiptFooterEn" rows={2} defaultValue={config.receiptFooterEn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-footAr">{t("receiptFooterAr")}</Label>
              <Textarea id="r-footAr" name="receiptFooterAr" rows={2} defaultValue={config.receiptFooterAr} dir="rtl" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox name="showLogoOnReceipt" value="true" defaultChecked={config.showLogoOnReceipt} />
              {t("showLogoOnReceipt")}
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel={tc("saving")}>{t("saveReceipt")}</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
