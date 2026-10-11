"use client";

import { useActionState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  changePlan,
  type ActionState,
} from "@/app/[locale]/(app)/subscription/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";
import { Check } from "lucide-react";
import { toast } from "sonner";

export type PlanCard = {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  priceMonthly: number;
  staffLimit: number;
  branchLimit: number;
  productLimit: number;
};

export function PlanCards({
  plans,
  currentCode,
  canManage,
}: {
  plans: PlanCard[];
  currentCode: string;
  canManage: boolean;
}) {
  const t = useTranslations("subscription");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action] = useActionState<ActionState, FormData>(changePlan, undefined);

  useEffect(() => {
    if (state?.ok) toast.success(t("changed"));
    else if (state?.error) toast.error(tc("required"));
  }, [state, t, tc]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => {
        const isCurrent = p.code === currentCode;
        return (
          <Card key={p.code} className={isCurrent ? "border-primary/50 shadow-sm" : undefined}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {locale === "ar" ? p.nameAr : p.nameEn}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-2xl font-bold" dir="ltr">
                {fmtMoney(p.priceMonthly)}
                <span className="text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
              </p>
              {p.descriptionEn && (
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? (p.descriptionAr ?? p.descriptionEn) : p.descriptionEn}
                </p>
              )}
              <ul className="flex flex-col gap-1.5 text-xs">
                <li className="flex items-center gap-1.5">
                  <Check className="size-3 text-emerald-600" />
                  {p.staffLimit <= 0 ? t("unlimited") : t("planFeatureStaff", { count: p.staffLimit })}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="size-3 text-emerald-600" />
                  {p.branchLimit <= 0 ? t("unlimited") : t("planFeatureBranches", { count: p.branchLimit })}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="size-3 text-emerald-600" />
                  {p.productLimit <= 0 ? t("unlimited") : t("planFeatureProducts", { count: p.productLimit })}
                </li>
              </ul>
              {isCurrent ? (
                <Button variant="outline" disabled>
                  {t("current")}
                </Button>
              ) : canManage ? (
                <form action={action}>
                  <input type="hidden" name="planCode" value={p.code} />
                  <Button type="submit" className="w-full">
                    {t("changePlan")}
                  </Button>
                </form>
              ) : (
                <Button variant="outline" disabled>
                  {t("changePlan")}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
