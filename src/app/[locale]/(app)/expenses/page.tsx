import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireTenantContext, branchFilter } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { requireUser, resolveRoleId } from "@/core/auth/session";
import { toNumber, fmtMoney, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseCategoryDialog } from "@/components/expenses/expense-category-dialog";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Pencil, Wallet } from "lucide-react";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; branchId?: string; from?: string; to?: string }>;
}) {
  const t = await getTranslations("expenses");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("expenses:read");

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can({ id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin }, "expenses:write");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const categoryId = sp.categoryId || undefined;
  const branchId = sp.branchId && (ctx.branchIds.length === 0 || ctx.branchIds.includes(sp.branchId)) ? sp.branchId : undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(new Date(sp.to).getTime() + 24 * 3600 * 1000) : undefined;

  const [branches, categories] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...(ctx.branchIds.length ? { id: { in: ctx.branchIds } } : {}) },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const where = {
    tenantId: ctx.tenantId,
    ...branchFilter(ctx),
    ...(branchId ? { branchId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(from || to ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [expenses, agg] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { nameAr: true, nameEn: true, color: true } },
        branch: { select: { nameAr: true, nameEn: true } },
        recorder: { select: { name: true, nameAr: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: 200,
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Wallet}
        actions={
          <div className="flex items-center gap-4">
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t("totalPeriod")}</p>
              <p className="text-lg font-semibold" dir="ltr">
                {fmtMoney(agg._sum.amount ?? 0)} {ctx.currencySymbol}
              </p>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <ExpenseCategoryDialog />
                <ExpenseFormDialog branches={branches} categories={categories} />
              </div>
            )}
          </div>
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/expenses">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("description")} className="ps-9" />
        </div>
        <select name="categoryId" defaultValue={categoryId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{t("category")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {locale === "ar" ? c.nameAr : c.nameEn}
            </option>
          ))}
        </select>
        <select name="branchId" defaultValue={branchId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">{tc("all")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {locale === "ar" ? b.nameAr : b.nameEn}
            </option>
          ))}
        </select>
        <Input type="date" name="from" defaultValue={sp.from ?? ""} className="w-40" dir="ltr" />
        <Input type="date" name="to" defaultValue={sp.to ?? ""} className="w-40" dir="ltr" />
        <Button type="submit" variant="secondary">
          {tc("filter")}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">{t("helper")}</p>

      {expenses.length === 0 ? (
        <EmptyState icon={Wallet} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead>{t("paymentMethod")}</TableHead>
                <TableHead>{t("recordedBy")}</TableHead>
                <TableHead className="text-end">{t("amount")}</TableHead>
                {canWrite && <TableHead className="text-end">{tc("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(e.expenseDate, locale)}</TableCell>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell>
                    {e.category ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="size-2 rounded-full" style={{ backgroundColor: e.category.color ?? "#64748b" }} />
                        {locale === "ar" ? e.category.nameAr : e.category.nameEn}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{locale === "ar" ? e.branch.nameAr : e.branch.nameEn}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.paymentMethod}</TableCell>
                  <TableCell className="text-sm">{locale === "ar" ? (e.recorder.nameAr ?? e.recorder.name) : e.recorder.name}</TableCell>
                  <TableCell className="text-end font-medium" dir="ltr">{fmtMoney(e.amount)}</TableCell>
                  {canWrite && (
                    <TableCell className="text-end">
                      <div className="flex justify-end">
                        <ExpenseFormDialog
                          branches={branches}
                          categories={categories}
                          expense={{
                            id: e.id,
                            branchId: e.branchId,
                            categoryId: e.categoryId,
                            description: e.description,
                            amount: String(toNumber(e.amount)),
                            expenseDate: e.expenseDate.toISOString().slice(0, 10),
                            paymentMethod: e.paymentMethod,
                            notes: e.notes,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" title={tc("edit")}>
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <DeleteExpenseButton id={e.id} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
