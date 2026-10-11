import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac";
import { resolveRoleId } from "@/core/auth/session";
import { requireUser } from "@/core/auth/session";
import { fmtMoney, toNumber, fmtInt } from "@/lib/format";
import { productSearchOr } from "@/lib/search";
import { getStoreConfig } from "@/lib/store-config";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Plus, Search, Shirt } from "lucide-react";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string }>;
}) {
  const t = await getTranslations("products");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("products:read");
  const config = await getStoreConfig(ctx.tenantId);

  const user = await requireUser();
  const roleId = await resolveRoleId(user);
  const canWrite = await can(
    { id: user.id, roleId, isPlatformAdmin: user.isPlatformAdmin },
    "products:write",
  );

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const lowOnly = sp.low === "1";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 24;

  const where = {
    tenantId: ctx.tenantId,
    ...(q ? { OR: productSearchOr(q) } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { nameAr: true, nameEn: true } },
      brand: { select: { nameAr: true, nameEn: true } },
      variants: {
        select: {
          id: true,
          isActive: true,
          balances: {
            where: { ...(ctx.branchIds.length ? { branchId: { in: ctx.branchIds } } : {}) },
            select: { quantity: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = products
    .map((p) => {
      const totalStock = p.variants.reduce(
        (sum, v) => sum + v.balances.reduce((s, b) => s + b.quantity, 0),
        0,
      );
      return { p, totalStock, variantCount: p.variants.filter((v) => v.isActive).length };
    })
    .filter((r) => (lowOnly ? r.totalStock <= config.lowStockThreshold : true));

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        icon={Shirt}
        actions={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/products/new">
                <Plus />
                {t("new")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form className="flex flex-wrap items-center gap-2" action="/products">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder={t("searchProducts")}
            className="ps-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="low"
            value="1"
            defaultChecked={lowOnly}
            className="size-4 rounded border-input"
          />
          {t("lowStockOnly")}
        </label>
        <Button type="submit" variant="secondary">
          {tc("search")}
        </Button>
      </form>

      {pageRows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            canWrite ? (
              <Button asChild size="sm">
                <Link href="/products/new">
                  <Plus />
                  {t("new")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameEn")}</TableHead>
                <TableHead>{t("sku")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="text-end">{t("price")}</TableHead>
                <TableHead className="text-end">{t("cost")}</TableHead>
                <TableHead className="text-end">{t("profit")}</TableHead>
                <TableHead className="text-end">{t("totalStock")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(({ p, totalStock, variantCount }) => {
                const price = toNumber(p.price);
                const cost = toNumber(p.cost);
                const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/products/${p.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {locale === "ar" ? p.nameAr : p.nameEn}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.brand ? (locale === "ar" ? p.brand.nameAr : p.brand.nameEn) : "—"}
                        {" · "}
                        {variantCount} {t("variants")}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>
                      {p.category
                        ? locale === "ar"
                          ? p.category.nameAr
                          : p.category.nameEn
                        : "—"}
                    </TableCell>
                    <TableCell className="text-end" dir="ltr">
                      {fmtMoney(price)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground" dir="ltr">
                      {fmtMoney(cost)}
                    </TableCell>
                    <TableCell className="text-end" dir="ltr">
                      {margin}%
                    </TableCell>
                    <TableCell className="text-end">
                      <span
                        className={
                          totalStock <= config.lowStockThreshold
                            ? "font-semibold text-warning"
                            : "font-medium"
                        }
                        dir="ltr"
                      >
                        {fmtInt(totalStock)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.status === "ACTIVE" ? (
                        <Badge variant="secondary">{t("active")}</Badge>
                      ) : p.status === "DRAFT" ? (
                        <Badge variant="outline">{t("draft")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("archived")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tc("page")} {page} {tc("of")} {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ pathname: "/products", query: { ...(q ? { q } : {}), ...(lowOnly ? { low: "1" } : {}), page: page - 1 } }}>
                  {tc("previous")}
                </Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ pathname: "/products", query: { ...(q ? { q } : {}), ...(lowOnly ? { low: "1" } : {}), page: page + 1 } }}>
                  {tc("next")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
