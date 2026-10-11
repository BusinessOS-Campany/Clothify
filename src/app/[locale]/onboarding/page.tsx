import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/core/auth/session";
import { BrandMark } from "@/components/brand";
import {
  OnboardingForm,
  type PlanOption,
  type ExistingTenant,
} from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const t = await getTranslations("onboarding");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const memberships = await prisma.tenantMember.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      role: { select: { code: true } },
      tenant: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });

  // Already inside a store → straight to the dashboard.
  if (user.currentTenantId && memberships.some((m) => m.tenantId === user.currentTenantId)) {
    redirect({ href: "/", locale });
  }

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const planOptions: PlanOption[] = plans.map((p) => ({
    code: p.code,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    priceMonthly: p.priceMonthly.toNumber(),
    staffLimit: p.staffLimit,
    branchLimit: p.branchLimit,
    productLimit: p.productLimit,
  }));

  const existingTenants: ExistingTenant[] = memberships.map((m) => ({
    id: m.tenant.id,
    nameEn: m.tenant.nameEn,
    nameAr: m.tenant.nameAr,
    roleCode: m.role.code,
  }));

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col items-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-12" />
        <p className="text-lg font-semibold">{tc("appName")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcome", { name: user.name })}
        </h1>
      </div>

      <OnboardingForm
        plans={planOptions}
        existingTenants={existingTenants}
        locale={locale}
      />
    </div>
  );
}