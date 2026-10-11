import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { fmtMoney, fmtInt } from "@/lib/format";
import { REPORT_KEYS, runReport, type ReportKey } from "@/lib/reports";
import { PageHeader } from "@/components/layout/page-header";
import { ReportTable, type Column } from "@/components/reports/report-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3 } from "lucide-react";
import { Link } from "@/i18n/navigation";

const DEFAULT_REPORT: ReportKey = "dailySales";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string; branchId?: string }>;
}) {
  const t = await getTranslations();
  const ctx = await requireTenantContext();
  await requirePermission("reports:read");
  const locale = await getLocale();

  const sp = await searchParams;
  const report: ReportKey = (REPORT_KEYS as readonly string[]).includes(sp.report ?? "")
    ? (sp.report as ReportKey)
    : DEFAULT_REPORT;

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(new Date(sp.to).getTime() + 24 * 3600 * 1000) : new Date(now.getTime() + 24 * 3600 * 1000);
  const branchId = sp.branchId && (ctx.branchIds.length === 0 || ctx.branchIds.includes(sp.branchId)) ? sp.branchId : undefined;

  const branches = await prisma.branch.findMany({
    where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
    select: { id: true, nameAr: true, nameEn: true },
    orderBy: { nameEn: "asc" },
  });

  const result = await runReport({
    tenantId: ctx.tenantId,
    report,
    from,
    to,
    branchId,
    branchIds: ctx.branchIds,
    locale,
    t,
  });

  const columns: Column[] = result.columns.map((c) => ({ ...c, label: t(c.labelKey) }));
  const fromStr = sp.from ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.to ?? now.toISOString().slice(0, 10);

  const calcHint: Record<string, string[]> = {
    grossProfit: ["reports.calcRevenue", "reports.calcCogs", "reports.calcGross", "reports.calcNet"],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("reports.title")} description={t("reports.subtitle")} icon={BarChart3} />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="flex flex-col gap-1">
          {REPORT_KEYS.map((key) => (
            <Link
              key={key}
              href={`/reports?report=${key}&from=${fromStr}&to=${toStr}${branchId ? `&branchId=${branchId}` : ""}`}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                key === report ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(`reports.${key}`)}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-2" action="/reports">
            <input type="hidden" name="report" value={report} />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("common.from")}</span>
              <Input type="date" name="from" defaultValue={fromStr} className="w-40" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("common.to")}</span>
              <Input type="date" name="to" defaultValue={toStr} className="w-40" dir="ltr" />
            </div>
            <select
              name="branchId"
              defaultValue={branchId ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">{t("common.all")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              {t("reports.generate")}
            </Button>
            <Button asChild variant="outline">
              <a
                href={`/api/reports/export?report=${report}&from=${fromStr}&to=${toStr}${branchId ? `&branchId=${branchId}` : ""}`}
              >
                {t("common.exportCsv")}
              </a>
            </Button>
          </form>

          {result.summary && result.summary.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {result.summary.map((s) => (
                <Card key={s.labelKey}>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">{t(s.labelKey)}</p>
                    <p className="text-lg font-semibold" dir="ltr">
                      {s.kind === "money" ? fmtMoney(s.value) : fmtInt(Math.round(s.value))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <ReportTable columns={columns} rows={result.rows} emptyLabel={t("reports.noData")} />

          {calcHint[report] && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-xs font-medium">{t("reports.howCalculated")}</p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {calcHint[report]!.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
