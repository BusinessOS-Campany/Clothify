import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { getSubscription } from "@/core/subscriptions";
import { PageHeader } from "@/components/layout/page-header";
import { PlanCards, type PlanCard } from "@/components/subscription/plan-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toNumber, fmtMoney, fmtDate } from "@/lib/format";
import { CreditCard } from "lucide-react";

const STATUS_CLASS: Record<string, string> = {
  DEVELOPMENT: "border-violet-500/40 text-violet-600",
  ACTIVE: "border-emerald-500/40 text-emerald-600",
  TRIAL: "border-blue-500/40 text-blue-600",
  PAST_DUE: "border-amber-500/40 text-amber-600",
  CANCELED: "text-muted-foreground",
};

export default async function SubscriptionPage() {
  const t = await getTranslations("subscription");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("subscription:read");
  const user = await requireUser();
  const canManage = user.isPlatformAdmin || ctx.roleCode === "owner";

  const sub = await getSubscription(ctx.tenantId);

  const [plans, staffCount, branchCount, productCount, billing] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tenantMember.count({ where: { tenantId: ctx.tenantId } }),
    prisma.branch.count({ where: { tenantId: ctx.tenantId } }),
    prisma.product.count({ where: { tenantId: ctx.tenantId } }),
    prisma.billingHistory.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  ]);

  const planCards: PlanCard[] = plans.map((p) => ({
    code: p.code,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    priceMonthly: toNumber(p.priceMonthly),
    staffLimit: p.staffLimit,
    branchLimit: p.branchLimit,
    productLimit: p.productLimit,
  }));

  const statusKey =
    sub?.status === "DEVELOPMENT"
      ? "development"
      : sub?.status === "ACTIVE"
        ? "active"
        : sub?.status === "TRIAL"
          ? "trial"
          : sub?.status === "PAST_DUE"
            ? "pastDue"
            : "canceled";

  function usage(current: number, limit: number) {
    if (limit <= 0) return { pct: 0, current, limit, unlimited: true };
    return { pct: Math.min(100, Math.round((current / limit) * 100)), current, limit, unlimited: false };
  }

  const usages = sub
    ? [
        { key: "staffUsage", ...usage(staffCount, sub.staffLimit) },
        { key: "branchUsage", ...usage(branchCount, sub.branchLimit) },
        { key: "productUsage", ...usage(productCount, sub.productLimit) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} icon={CreditCard} />

      {sub?.development && (
        <p className="rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-sm text-violet-700">
          {t("devBanner")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("currentPlan")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">
                {sub ? (locale === "ar" ? sub.planNameAr : sub.planNameEn) : "—"}
              </span>
              <Badge variant="outline" className={STATUS_CLASS[sub?.status ?? ""] ?? ""}>
                {t(statusKey as "active")}
              </Badge>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {sub?.trialEndsAt && <span>{t("trialEnds")}: {fmtDate(sub.trialEndsAt, locale)}</span>}
              {sub?.currentPeriodEnd && <span>{t("renewsOn")}: {fmtDate(sub.currentPeriodEnd, locale)}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("usage")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {usages.map((u) => (
              <div key={u.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t(u.key as "staffUsage")}</span>
                  <span dir="ltr">
                    {u.current}
                    {u.unlimited ? ` / ${t("unlimited")}` : ` / ${u.limit}`}
                  </span>
                </div>
                <Progress value={u.unlimited ? 0 : u.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <PlanCards plans={planCards} currentCode={sub?.planCode ?? "TRIAL"} canManage={canManage} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("billingHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {billing.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noBilling")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{t("period")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="text-end">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(b.createdAt, locale)}</TableCell>
                    <TableCell className="text-xs">
                      {b.periodStart ? fmtDate(b.periodStart, locale) : "—"} → {b.periodEnd ? fmtDate(b.periodEnd, locale) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{b.status}</TableCell>
                    <TableCell className="text-end" dir="ltr">{fmtMoney(b.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
