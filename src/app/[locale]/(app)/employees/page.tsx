import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { InviteEmployeeDialog } from "@/components/employees/invite-employee-dialog";
import { EmployeeEditDialog } from "@/components/employees/employee-edit-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";

export default async function EmployeesPage() {
  const t = await getTranslations("employees");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("employees:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "employees:write");

  const [members, branches] = await Promise.all([
    prisma.tenantMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: { select: { id: true, name: true, nameAr: true, nameEn: true, phone: true, email: true, username: true, isActive: true } },
        role: { select: { code: true, nameAr: true, nameEn: true } },
        branches: { select: { branchId: true, branch: { select: { nameAr: true, nameEn: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const roleName = (code: string, nameAr: string, nameEn: string) =>
    locale === "ar" ? nameAr : nameEn;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Users}
        actions={canWrite ? <InviteEmployeeDialog branches={branches} /> : undefined}
      />

      {members.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("jobTitle")}</TableHead>
                <TableHead>{t("branches")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canWrite && <TableHead className="text-end">{tc("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const active = m.isActive && m.user.isActive;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="font-medium">
                        {locale === "ar" ? (m.user.nameAr ?? m.user.name) : (m.user.nameEn ?? m.user.name)}
                      </span>
                      {m.user.username && (
                        <span className="block font-mono text-xs text-muted-foreground">@{m.user.username}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{m.user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleName(m.role.code, m.role.nameAr, m.role.nameEn)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.jobTitle ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {m.branches.length === 0
                        ? tc("all")
                        : m.branches.map((b) => (locale === "ar" ? b.branch.nameAr : b.branch.nameEn)).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={active ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"}>
                        {active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-end">
                        <div className="flex justify-end">
                          <EmployeeEditDialog
                            branches={branches}
                            employee={{
                              memberId: m.id,
                              user: {
                                nameEn: m.user.nameEn,
                                nameAr: m.user.nameAr,
                                phone: m.user.phone,
                                email: m.user.email,
                                username: m.user.username,
                              },
                              roleCode: m.role.code,
                              jobTitle: m.jobTitle,
                              hireDate: m.hireDate ? m.hireDate.toISOString().slice(0, 10) : null,
                              isActive: m.isActive,
                              branchIds: m.branches.map((b) => b.branchId),
                            }}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
