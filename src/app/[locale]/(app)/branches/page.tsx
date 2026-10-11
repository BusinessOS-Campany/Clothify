import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { fmtMoney } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { BranchFormDialog } from "@/components/branches/branch-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Store } from "lucide-react";

export default async function BranchesPage() {
  const t = await getTranslations("branches");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("branches:read");
  const user = await requireUser();
  const canManage = user.isPlatformAdmin || ctx.roleCode === "owner";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [branches, members, salesByBranch, balances] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      include: { manager: { select: { name: true, nameAr: true, nameEn: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    }),
    prisma.tenantMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: { user: { select: { id: true, name: true, nameAr: true, nameEn: true } } },
    }),
    prisma.sale.groupBy({
      by: ["branchId"],
      where: { tenantId: ctx.tenantId, status: "COMPLETED", saleDate: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { tenantId: ctx.tenantId, quantity: { gt: 0 } },
      select: { branchId: true, quantity: true, variant: { select: { cost: true } } },
    }),
  ]);

  const salesMap = new Map(salesByBranch.map((s) => [s.branchId, Number(s._sum.total ?? 0)]));
  const stockMap = new Map<string, number>();
  for (const b of balances) {
    stockMap.set(b.branchId, (stockMap.get(b.branchId) ?? 0) + b.quantity * b.variant.cost.toNumber());
  }

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    label: (locale === "ar" ? (m.user.nameAr ?? m.user.name) : (m.user.nameEn ?? m.user.name)) ?? m.user.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Store}
        actions={canManage ? <BranchFormDialog members={memberOptions} /> : undefined}
      />

      {branches.length === 0 ? (
        <EmptyState icon={Store} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{locale === "ar" ? b.nameAr : b.nameEn}</p>
                    <p className="font-mono text-xs text-muted-foreground">{b.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={b.isActive ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"}>
                      {b.isActive ? t("active") : t("inactive")}
                    </Badge>
                    {canManage && (
                      <BranchFormDialog
                        members={memberOptions}
                        branch={{
                          id: b.id,
                          code: b.code,
                          nameEn: b.nameEn,
                          nameAr: b.nameAr,
                          address: b.address,
                          phone: b.phone,
                          managerId: b.managerId,
                          openingHours:
                            b.openingHours && typeof b.openingHours === "object" && "note" in (b.openingHours as Record<string, unknown>)
                              ? String((b.openingHours as Record<string, unknown>).note ?? "")
                              : "",
                          isActive: b.isActive,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" title={tc("edit")}>
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("salesThisMonth")}</p>
                    <p className="font-semibold" dir="ltr">{fmtMoney(salesMap.get(b.id) ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("stockValue")}</p>
                    <p className="font-semibold" dir="ltr">{fmtMoney(stockMap.get(b.id) ?? 0)}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {b.manager && (
                    <span>{t("manager")}: {locale === "ar" ? (b.manager.nameAr ?? b.manager.name) : (b.manager.nameEn ?? b.manager.name)}</span>
                  )}
                  {b.phone && <span dir="ltr">{b.phone}</span>}
                  {b.address && <span>{b.address}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
