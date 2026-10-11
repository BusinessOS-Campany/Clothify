import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { fmtMoney, fmtInt } from "@/lib/format";
import { customerSearchOr } from "@/lib/search";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const t = await getTranslations("customers");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("customers:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "customers:write");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 50;

  const where = { tenantId: ctx.tenantId, ...(q ? { OR: customerSearchOr(q) } : {}) };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { sales: true } },
        sales: { where: { status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } }, select: { total: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const pages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Users}
        actions={canWrite ? <CustomerFormDialog /> : undefined}
      />

      <form className="flex flex-wrap items-center gap-2" action="/customers">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchCustomers")} className="ps-9" />
        </div>
        <Button type="submit" variant="secondary">
          {tc("search")}
        </Button>
      </form>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("name")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("segment")}</TableHead>
                <TableHead className="text-end">{t("purchases")}</TableHead>
                <TableHead className="text-end">{t("totalSpent")}</TableHead>
                <TableHead className="text-end">{t("loyaltyPoints")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const spent = c.sales.reduce((s, x) => s + Number(x.total), 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:text-primary hover:underline">
                        {locale === "ar" ? (c.nameAr ?? c.name) : c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.segment ?? "—"}</TableCell>
                    <TableCell className="text-end" dir="ltr">{fmtInt(c._count.sales)}</TableCell>
                    <TableCell className="text-end" dir="ltr">{fmtMoney(spent)}</TableCell>
                    <TableCell className="text-end" dir="ltr">{fmtInt(c.loyaltyPoints)}</TableCell>
                    <TableCell>
                      {c.isActive ? (
                        <Badge variant="secondary">{tc("active")}</Badge>
                      ) : (
                        <Badge variant="outline">{tc("inactive")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{tc("page")} {page} {tc("of")} {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ pathname: "/customers", query: { ...(q ? { q } : {}), page: page - 1 } }}>{tc("previous")}</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ pathname: "/customers", query: { ...(q ? { q } : {}), page: page + 1 } }}>{tc("next")}</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
