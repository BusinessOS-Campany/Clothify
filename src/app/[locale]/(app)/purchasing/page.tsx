import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { fmtMoney, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { PoStatusBadge } from "@/components/purchasing/po-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Plus } from "lucide-react";

export default async function PurchasingPage() {
  const t = await getTranslations("purchasing");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("purchasing:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "purchasing:write");

  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      supplier: { select: { name: true, nameAr: true } },
      branch: { select: { nameEn: true, nameAr: true } },
      _count: { select: { items: true, receipts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={ClipboardList}
        actions={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/purchasing/new">
                <Plus />
                {t("newPo")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("poNumber")}</TableHead>
                <TableHead>{t("supplier")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead className="text-end">{t("orderTotal")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link href={`/purchasing/${po.id}`} className="font-mono text-xs font-medium hover:text-primary hover:underline">
                      {po.poNo}
                    </Link>
                  </TableCell>
                  <TableCell>{locale === "ar" ? (po.supplier.nameAr ?? po.supplier.name) : po.supplier.name}</TableCell>
                  <TableCell>{locale === "ar" ? po.branch.nameAr : po.branch.nameEn}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(po.createdAt, locale)}</TableCell>
                  <TableCell className="text-end" dir="ltr">{fmtMoney(po.total)}</TableCell>
                  <TableCell>
                    <PoStatusBadge status={po.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
