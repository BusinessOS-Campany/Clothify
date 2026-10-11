import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import {
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
} from "@/app/[locale]/(app)/inventory/actions";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
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
import { ArrowLeftRight } from "lucide-react";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("inventory");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");
  const { id } = await params;

  const transfer = await prisma.inventoryTransfer.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      fromBranch: { select: { nameAr: true, nameEn: true } },
      toBranch: { select: { nameAr: true, nameEn: true } },
      items: {
        include: {
          variant: {
            select: { sku: true, optionEn: true, product: { select: { nameAr: true, nameEn: true } } },
          },
        },
      },
    },
  });
  if (!transfer) notFound();

  const canDispatch = transfer.status === "PENDING";
  const canReceive = transfer.status === "IN_TRANSIT";
  const canCancel = transfer.status === "PENDING" || transfer.status === "IN_TRANSIT";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t("transferNo")} ${transfer.transferNo}`}
        description={`${locale === "ar" ? transfer.fromBranch.nameAr : transfer.fromBranch.nameEn} → ${
          locale === "ar" ? transfer.toBranch.nameAr : transfer.toBranch.nameEn
        }`}
        icon={ArrowLeftRight}
        actions={<StatusBadge status={transfer.status} />}
      />

      <InventoryTabs />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("fromBranch")}</p>
            <p className="font-medium">{locale === "ar" ? transfer.fromBranch.nameAr : transfer.fromBranch.nameEn}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("toBranch")}</p>
            <p className="font-medium">{locale === "ar" ? transfer.toBranch.nameAr : transfer.toBranch.nameEn}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("lastMovement")}</p>
            <p className="font-medium">{fmtDateTime(transfer.createdAt, locale)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("variant")}</TableHead>
              <TableHead className="text-end">{t("quantity")}</TableHead>
              <TableHead className="text-end">{t("counted")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfer.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {locale === "ar" ? item.variant.product.nameAr : item.variant.product.nameEn}
                </TableCell>
                <TableCell className="font-mono text-xs">{item.variant.sku}</TableCell>
                <TableCell className="text-end" dir="ltr">
                  {fmtInt(item.quantity)}
                </TableCell>
                <TableCell className="text-end" dir="ltr">
                  {fmtInt(item.receivedQuantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(canDispatch || canReceive || canCancel) && (
        <div className="flex justify-end gap-2">
          {canCancel && (
            <form action={cancelTransfer}>
              <input type="hidden" name="id" value={transfer.id} />
              <Button type="submit" variant="outline" className="text-destructive hover:text-destructive">
                {t("cancelled")}
              </Button>
            </form>
          )}
          {canDispatch && (
            <form action={dispatchTransfer}>
              <input type="hidden" name="id" value={transfer.id} />
              <Button type="submit">{t("sendTransfer")}</Button>
            </form>
          )}
          {canReceive && (
            <form action={receiveTransfer}>
              <input type="hidden" name="id" value={transfer.id} />
              <Button type="submit">{t("completeTransfer")}</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
