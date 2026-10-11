import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { supplierSearchOr } from "@/lib/search";
import { fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  SupplierFormDialog,
  type SupplierValues,
} from "@/components/suppliers/supplier-form-dialog";
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
import { Pencil, Search, Truck } from "lucide-react";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getTranslations("suppliers");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("suppliers:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "suppliers:write");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: ctx.tenantId, ...(q ? { OR: supplierSearchOr(q) } : {}) },
    include: { _count: { select: { products: true, purchaseOrders: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Truck}
        actions={canWrite ? <SupplierFormDialog /> : undefined}
      />

      <form className="flex flex-wrap items-center gap-2" action="/suppliers">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchSuppliers")} className="ps-9" />
        </div>
        <Button type="submit" variant="secondary">
          {tc("search")}
        </Button>
      </form>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("contactName")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead className="text-end">{t("productsSupplied")}</TableHead>
                <TableHead className="text-end">{t("purchases")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
                <TableHead className="text-end">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {locale === "ar" ? (s.nameAr ?? s.name) : s.name}
                  </TableCell>
                  <TableCell>{s.contactName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{s.phone ?? "—"}</TableCell>
                  <TableCell className="text-end" dir="ltr">{fmtInt(s._count.products)}</TableCell>
                  <TableCell className="text-end" dir="ltr">{fmtInt(s._count.purchaseOrders)}</TableCell>
                  <TableCell>
                    {s.isActive ? (
                      <Badge variant="secondary">{tc("active")}</Badge>
                    ) : (
                      <Badge variant="outline">{tc("inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {canWrite && (
                      <SupplierFormDialog
                        supplier={toValues(s)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={tc("edit")}>
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    )}
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

function toValues(s: {
  id: string;
  name: string;
  nameAr: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
}): SupplierValues {
  return {
    id: s.id,
    name: s.name,
    nameAr: s.nameAr,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    address: s.address,
    taxId: s.taxId,
    notes: s.notes,
    isActive: s.isActive,
  };
}
