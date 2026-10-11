import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import {
  cancelPurchaseOrder,
  markOrdered,
} from "@/app/[locale]/(app)/purchasing/actions";
import { toNumber, fmtMoney, fmtDate, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { PoStatusBadge } from "@/components/purchasing/po-status-badge";
import {
  ReceiveGoodsDialog,
  type ReceivableItem,
} from "@/components/purchasing/receive-goods-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList } from "lucide-react";

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("purchasing");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:read");
  const { id } = await params;

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const subject = { id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin };
  const canWrite = await can(subject, "purchasing:write");
  const canReceive = await can(subject, "purchasing:receive");

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      supplier: { select: { name: true, nameAr: true, phone: true } },
      branch: { select: { nameEn: true, nameAr: true } },
      items: {
        include: {
          variant: { select: { sku: true, optionEn: true, product: { select: { nameAr: true, nameEn: true } } } },
        },
      },
      receipts: { include: { items: true }, orderBy: { receivedAt: "desc" } },
    },
  });
  if (!po) notFound();

  const receivable: ReceivableItem[] = po.items
    .filter((i) => i.quantity - i.receivedQuantity > 0)
    .map((i) => ({
      poItemId: i.id,
      name: locale === "ar" ? i.variant.product.nameAr : i.variant.product.nameEn,
      variantLabel: i.variant.optionEn ?? i.variant.sku,
      unitCost: toNumber(i.unitCost),
      quantity: i.quantity,
      receivedQuantity: i.receivedQuantity,
    }));

  const showReceive = canReceive && ["ORDERED", "PARTIAL"].includes(po.status) && receivable.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t("poNumber")} ${po.poNo}`}
        description={fmtDate(po.createdAt, locale)}
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            <PoStatusBadge status={po.status} />
            {showReceive && <ReceiveGoodsDialog poId={po.id} items={receivable} />}
            {canWrite && po.status === "DRAFT" && (
              <form action={markOrdered}>
                <input type="hidden" name="id" value={po.id} />
                <Button type="submit" variant="outline" size="sm">
                  {t("markOrdered")}
                </Button>
              </form>
            )}
            {canWrite && ["DRAFT", "ORDERED", "PARTIAL"].includes(po.status) && (
              <form action={cancelPurchaseOrder}>
                <input type="hidden" name="id" value={po.id} />
                <Button type="submit" variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  {t("cancelPo")}
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{t("supplier")}</p>
            <p className="font-medium">{locale === "ar" ? (po.supplier.nameAr ?? po.supplier.name) : po.supplier.name}</p>
            {po.supplier.phone && <p className="text-xs text-muted-foreground" dir="ltr">{po.supplier.phone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{t("branch")}</p>
            <p className="font-medium">{locale === "ar" ? po.branch.nameAr : po.branch.nameEn}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="text-xs text-muted-foreground">{t("expectedDate")}</p>
            <p className="font-medium">
              {po.expectedDeliveryDate ? fmtDate(po.expectedDeliveryDate, locale) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("supplier")}</TableHead>
              <TableHead className="text-end">{t("orderedQty")}</TableHead>
              <TableHead className="text-end">{t("receivedQty")}</TableHead>
              <TableHead className="text-end">{t("unitCost")}</TableHead>
              <TableHead className="text-end">{t("lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-medium">{locale === "ar" ? i.variant.product.nameAr : i.variant.product.nameEn}</span>
                  <span className="block text-xs text-muted-foreground">{i.variant.optionEn ?? i.variant.sku}</span>
                </TableCell>
                <TableCell className="text-end" dir="ltr">{i.quantity}</TableCell>
                <TableCell className="text-end" dir="ltr">{i.receivedQuantity}</TableCell>
                <TableCell className="text-end" dir="ltr">{fmtMoney(i.unitCost)}</TableCell>
                <TableCell className="text-end" dir="ltr">{fmtMoney(i.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("orderTotal")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tc("subtotal")}</span>
              <span dir="ltr">{fmtMoney(po.subtotal)}</span>
            </div>
            {toNumber(po.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tc("tax")} ({toNumber(po.taxRate)}%)</span>
                <span dir="ltr">{fmtMoney(po.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{tc("total")}</span>
              <span dir="ltr">{fmtMoney(po.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("receipts")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {po.receipts.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              po.receipts.map((r) => (
                <div key={r.id} className="flex justify-between">
                  <span className="font-mono text-xs">{r.receiptNo}</span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(r.receivedAt, locale)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
