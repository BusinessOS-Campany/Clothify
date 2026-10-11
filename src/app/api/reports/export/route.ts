import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { REPORT_KEYS, runReport, type ReportKey } from "@/lib/reports";

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const ctx = await requireTenantContext();
  await requirePermission("reports:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const allowed = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "reports:export");
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const sp = url.searchParams;
  const report: ReportKey = (REPORT_KEYS as readonly string[]).includes(sp.get("report") ?? "")
    ? (sp.get("report") as ReportKey)
    : "dailySales";

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
  const from = sp.get("from") ? new Date(sp.get("from") as string) : defaultFrom;
  const to = sp.get("to") ? new Date(new Date(sp.get("to") as string).getTime() + 24 * 3600 * 1000) : new Date(now.getTime() + 24 * 3600 * 1000);
  const branchIdParam = sp.get("branchId") ?? undefined;
  const branchId = branchIdParam && (ctx.branchIds.length === 0 || ctx.branchIds.includes(branchIdParam)) ? branchIdParam : undefined;

  const locale = await getLocale();
  const t = await getTranslations();

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

  const header = result.columns.map((c) => csvCell(t(c.labelKey))).join(",");
  const body = result.rows.map((row) => result.columns.map((c) => csvCell(row[c.key] ?? "")).join(",")).join("\n");
  const csv = `${header}\n${body}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${report}.csv"`,
    },
  });
}
