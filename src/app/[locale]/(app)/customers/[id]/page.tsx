import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { toNumber, fmtMoney, fmtDateTime, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import {
  CustomerFormDialog,
  type CustomerValues,
} from "@/components/customers/customer-form-dialog";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Receipt, Users } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("customers");
  const ts = await getTranslations("sales");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("customers:read");
  const { id } = await params;

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "customers:write");

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      sales: {
        orderBy: { saleDate: "desc" },
        take: 50,
        select: { id: true, saleNo: true, saleDate: true, total: true, status: true },
      },
    },
  });
  if (!customer) notFound();

  const spent = customer.sales
    .filter((s) => s.status !== "CANCELLED")
    .reduce((s, x) => s + toNumber(x.total), 0);

  const values: CustomerValues = {
    id: customer.id,
    name: customer.name,
    nameAr: customer.nameAr,
    phone: customer.phone,
    phone2: customer.phone2,
    email: customer.email,
    address: customer.address,
    segment: customer.segment,
    creditLimit: customer.creditLimit ? String(toNumber(customer.creditLimit)) : null,
    notes: customer.notes,
    isActive: customer.isActive,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={locale === "ar" ? (customer.nameAr ?? customer.name) : customer.name}
        description={customer.phone ?? undefined}
        icon={Users}
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <CustomerFormDialog
                customer={values}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    {tc("edit")}
                  </Button>
                }
              />
              <DeleteCustomerButton id={customer.id} />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("totalSpent")}</p>
            <p className="text-lg font-semibold" dir="ltr">{fmtMoney(spent)} {ctx.currencySymbol}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("purchases")}</p>
            <p className="text-lg font-semibold" dir="ltr">{fmtInt(customer.sales.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("loyaltyPoints")}</p>
            <p className="text-lg font-semibold" dir="ltr">{fmtInt(customer.loyaltyPoints)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">{t("history")}</h2>
        {customer.sales.length === 0 ? (
          <EmptyState icon={Receipt} title={t("noPurchases")} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ts("orderNo")}</TableHead>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead className="text-end">{tc("total")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/sales/${s.id}`} className="font-mono text-xs font-medium hover:text-primary hover:underline">
                        {s.saleNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(s.saleDate, locale)}</TableCell>
                    <TableCell className="text-end" dir="ltr">{fmtMoney(s.total)}</TableCell>
                    <TableCell>
                      <SaleStatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
