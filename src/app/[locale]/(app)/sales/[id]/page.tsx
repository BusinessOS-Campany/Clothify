import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { toNumber, fmtMoney, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { RefundDialog, type RefundableItem } from "@/components/sales/refund-dialog";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("sales");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("sales:read");
  const { id } = await params;

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const subject = { id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin };
  const canRefund = await can(subject, "sales:refund");
  const canCancel = await can(subject, "sales:cancel");

  const sale = await prisma.sale.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      customer: { select: { name: true, nameAr: true, phone: true } },
      cashier: { select: { name: true, nameAr: true } },
      branch: { select: { nameAr: true, nameEn: true } },
      items: true,
      payments: true,
      refunds: { include: { items: true }, orderBy: { refundDate: "desc" } },
    },
  });
  if (!sale) notFound();

  const refundable: RefundableItem[] = sale.items
    .filter((i) => i.quantity - i.returnedQty > 0)
    .map((i) => ({
      saleItemId: i.id,
      name: locale === "ar" ? i.productNameAr : i.productNameEn,
      variantLabel: i.variantLabel,
      unitPrice: toNumber(i.unitPrice),
      quantity: i.quantity,
      returnedQty: i.returnedQty,
    }));

  const totalPaid = sale.payments
    .filter((p) => !p.refundId)
    .reduce((s, p) => s + toNumber(p.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t("orderNo")} ${sale.saleNo}`}
        description={fmtDateTime(sale.saleDate, locale)}
        icon={Receipt}
        actions={
          <div className="flex items-center gap-2">
            <SaleStatusBadge status={sale.status} />
            {canRefund && refundable.length > 0 && sale.status !== "CANCELLED" && (
              <RefundDialog saleId={sale.id} items={refundable} />
            )}
            {canCancel && sale.status === "COMPLETED" && <CancelSaleButton saleId={sale.id} />}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{t("customer")}</p>
            <p className="font-medium">
              {sale.customer
                ? locale === "ar"
                  ? (sale.customer.nameAr ?? sale.customer.name)
                  : sale.customer.name
                : "—"}
            </p>
            {sale.customer?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{sale.customer.phone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{t("cashier")}</p>
            <p className="font-medium">
              {locale === "ar" ? (sale.cashier.nameAr ?? sale.cashier.name) : sale.cashier.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? sale.branch.nameAr : sale.branch.nameEn}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{tc("total")}</p>
            <p className="text-lg font-semibold" dir="ltr">
              {fmtMoney(sale.total)} {ctx.currencySymbol}
            </p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {t("payment")}: {fmtMoney(totalPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("items")}</TableHead>
              <TableHead className="text-end">{tc("quantity")}</TableHead>
              <TableHead className="text-end">{tc("price")}</TableHead>
              <TableHead className="text-end">{tc("total")}</TableHead>
              <TableHead className="text-end">{t("refund")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-medium">{locale === "ar" ? i.productNameAr : i.productNameEn}</span>
                  {i.variantLabel && <span className="block text-xs text-muted-foreground">{i.variantLabel}</span>}
                </TableCell>
                <TableCell className="text-end" dir="ltr">{i.quantity}</TableCell>
                <TableCell className="text-end" dir="ltr">{fmtMoney(i.unitPrice)}</TableCell>
                <TableCell className="text-end" dir="ltr">{fmtMoney(i.total)}</TableCell>
                <TableCell className="text-end" dir="ltr">{i.returnedQty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("payment")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {sale.payments
              .filter((p) => !p.refundId)
              .map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="text-muted-foreground">{p.method}</span>
                  <span dir="ltr">{fmtMoney(p.amount)}</span>
                </div>
              ))}
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">{tc("subtotal")}</span>
              <span dir="ltr">{fmtMoney(sale.subtotal)}</span>
            </div>
            {toNumber(sale.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tc("discount")}</span>
                <span dir="ltr">-{fmtMoney(sale.discount)}</span>
              </div>
            )}
            {toNumber(sale.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {tc("tax")} ({toNumber(sale.taxRate)}%)
                </span>
                <span dir="ltr">{fmtMoney(sale.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{tc("total")}</span>
              <span dir="ltr">{fmtMoney(sale.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("refund")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {sale.refunds.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              sale.refunds.map((r) => (
                <div key={r.id} className="flex justify-between">
                  <span className="font-mono text-xs">{r.refundNo}</span>
                  <span dir="ltr">-{fmtMoney(r.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
