import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { StatusBadge } from "@/components/inventory/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Plus } from "lucide-react";

export default async function TransfersPage() {
  const t = await getTranslations("inventory");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("inventory:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can(
    { id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin },
    "inventory:transfer",
  );

  const transfers = await prisma.inventoryTransfer.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      fromBranch: { select: { nameAr: true, nameEn: true } },
      toBranch: { select: { nameAr: true, nameEn: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("transfers")}
        description={t("subtitle")}
        icon={ArrowLeftRight}
        actions={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/inventory/transfers/new">
                <Plus />
                {t("createTransfer")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <InventoryTabs />

      {transfers.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={t("empty")} description={t("transferItemsHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("transferNo")}</TableHead>
                <TableHead>{t("fromBranch")}</TableHead>
                <TableHead>{t("toBranch")}</TableHead>
                <TableHead>{t("items")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("transferStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell>
                    <Link href={`/inventory/transfers/${tr.id}`} className="font-mono text-xs font-medium hover:text-primary hover:underline">
                      {tr.transferNo}
                    </Link>
                  </TableCell>
                  <TableCell>{locale === "ar" ? tr.fromBranch.nameAr : tr.fromBranch.nameEn}</TableCell>
                  <TableCell>{locale === "ar" ? tr.toBranch.nameAr : tr.toBranch.nameEn}</TableCell>
                  <TableCell dir="ltr">{tr._count.items}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(tr.createdAt, locale)}</TableCell>
                  <TableCell>
                    <StatusBadge status={tr.status} />
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
