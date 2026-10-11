"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Check, Loader2, Store } from "lucide-react";
import { createStore, selectTenant, type CreateStoreState } from "@/app/[locale]/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PlanOption = {
  code: "TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  nameEn: string;
  nameAr: string;
  priceMonthly: number;
  staffLimit: number;
  branchLimit: number;
  productLimit: number;
};

export type ExistingTenant = {
  id: string;
  nameEn: string;
  nameAr: string;
  roleCode: string;
};

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "SAR", symbol: "﷼", label: "Saudi Riyal" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
  { code: "YER", symbol: "﷼", label: "Yemeni Rial" },
  { code: "EGP", symbol: "£", label: "Egyptian Pound" },
  { code: "JOD", symbol: "د.ا", label: "Jordanian Dinar" },
];

export function OnboardingForm({
  plans,
  existingTenants,
  locale,
}: {
  plans: PlanOption[];
  existingTenants: ExistingTenant[];
  locale: string;
}) {
  const t = useTranslations("onboarding");
  const [state, action, pending] = useActionState<CreateStoreState, FormData>(
    createStore,
    undefined,
  );
  const [currency, setCurrency] = useState("USD");
  const [plan, setPlan] = useState<PlanOption["code"]>("TRIAL");
  const [nameEn, setNameEn] = useState("");
  const isAr = locale === "ar";

  const slug = nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-6">
      {existingTenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("yourStores")}</CardTitle>
            <CardDescription>{t("yourStoresHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {existingTenants.map((tenant) => (
              <form key={tenant.id} action={selectTenant}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-start transition-colors hover:bg-accent"
                >
                  <span className="flex items-center gap-3">
                    <Store className="size-4 text-primary" />
                    <span className="text-sm font-medium">
                      {isAr ? tenant.nameAr : tenant.nameEn}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tenant.roleCode}
                  </span>
                </button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Store className="size-5" />
          </div>
          <CardTitle className="text-xl">{t("createStoreTitle")}</CardTitle>
          <CardDescription>{t("createStoreSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nameEn">{t("storeNameEn")}</Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Zahra Fashion"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nameAr">{t("storeNameAr")}</Label>
                <Input
                  id="nameAr"
                  name="nameAr"
                  required
                  dir="rtl"
                  placeholder="زهرة للأزياء"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">{t("storeUrl")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  clothify.app/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  required
                  value={slug}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{t("currency")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="currency"
                  value={currency}
                />
                <input
                  type="hidden"
                  name="currencySymbol"
                  value={CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$"}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="locale">{t("defaultLanguage")}</Label>
                <Select name="locale" defaultValue={locale}>
                  <SelectTrigger id="locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Label>{t("plan")}</Label>
              <input type="hidden" name="planCode" value={plan} />
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((p) => {
                  const active = plan === p.code;
                  return (
                    <motion.button
                      key={p.code}
                      type="button"
                      onClick={() => setPlan(p.code)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-4 text-start transition-colors",
                        active
                          ? "border-primary bg-accent/60 ring-1 ring-primary"
                          : "hover:border-primary/40",
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {isAr ? p.nameAr : p.nameEn}
                        </span>
                        {active && <Check className="size-4 text-primary" />}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.priceMonthly > 0
                          ? `$${p.priceMonthly}/mo`
                          : t("free")}
                      </span>
                      <span className="mt-1 text-[11px] text-muted-foreground">
                        {t("limits", {
                          staff: p.staffLimit,
                          branches: p.branchLimit,
                          products: p.productLimit,
                        })}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {state?.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {state.error === "slugTaken"
                  ? t("slugTaken")
                  : state.error === "rolesMissing" || state.error === "planMissing"
                    ? t("notSeeded")
                    : t("error")}
              </p>
            )}

            <Button type="submit" disabled={pending} className="h-10 w-full">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("createStore")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}