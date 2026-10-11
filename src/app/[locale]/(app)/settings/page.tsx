import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { getStoreConfigFresh } from "@/lib/store-config";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Users } from "lucide-react";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const ctx = await requireTenantContext();
  await requirePermission("settings:read");
  const user = await requireUser();
  const canManage = user.isPlatformAdmin || ctx.roleCode === "owner";

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: ctx.tenantId },
    select: {
      nameEn: true,
      nameAr: true,
      phone: true,
      email: true,
      address: true,
      vatNumber: true,
      logoUrl: true,
      currency: true,
      currencySymbol: true,
      timezone: true,
      dateFormat: true,
      locale: true,
    },
  });
  const config = await getStoreConfigFresh(ctx.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} icon={Settings} />

      {!canManage && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
          {locale === "ar"
            ? "يمكنك عرض الإعدادات فقط. التعديل متاح لمالك المتجر فقط."
            : "You have read-only access. Only the store owner can change settings."}
        </p>
      )}

      {canManage ? (
        <SettingsForm
          tenant={{
            nameEn: tenant.nameEn,
            nameAr: tenant.nameAr,
            phone: tenant.phone,
            email: tenant.email,
            address: tenant.address,
            vatNumber: tenant.vatNumber,
            logoUrl: tenant.logoUrl,
            currency: tenant.currency,
            currencySymbol: tenant.currencySymbol,
            timezone: tenant.timezone,
            dateFormat: tenant.dateFormat,
            locale: tenant.locale,
          }}
          config={config}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("store")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">{t("storeNameEn")}: </span>{tenant.nameEn}</p>
            <p><span className="text-muted-foreground">{t("storeNameAr")}: </span>{tenant.nameAr}</p>
            <p><span className="text-muted-foreground">{t("currency")}: </span>{tenant.currency} ({tenant.currencySymbol})</p>
            <p><span className="text-muted-foreground">{t("timezone")}: </span>{tenant.timezone}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{t("team")}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">
              <Users className="size-4" />
              {t("manageUsers")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("roleAndAccess")}</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{tc("appName")}</p>
    </div>
  );
}
