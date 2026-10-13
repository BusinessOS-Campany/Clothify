/**
 * Subscription plan catalogue.
 *
 * Pure data with no Prisma import, so both the development seed and the
 * per-organization `prisma/bootstrap.ts` can share one definition and a plan
 * cannot drift between the two. `code` mirrors the `SubscriptionPlanCode` enum
 * in `prisma/schema.prisma`.
 */

export type PlanCode = "TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export type PlanSeed = {
  code: PlanCode;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priceMonthly: number;
  staffLimit: number;
  branchLimit: number;
  productLimit: number;
  sortOrder: number;
};

export const SUBSCRIPTION_PLANS: PlanSeed[] = [
  { code: "TRIAL", nameAr: "تجربة مجانية", nameEn: "Free Trial", priceMonthly: 0, staffLimit: 3, branchLimit: 1, productLimit: 100, sortOrder: 0, descriptionAr: "استكشف كل الميزات لمدة 14 يوماً", descriptionEn: "Explore all features for 14 days" },
  { code: "STARTER", nameAr: "المبتدئ", nameEn: "Starter", priceMonthly: 19, staffLimit: 5, branchLimit: 2, productLimit: 500, sortOrder: 1, descriptionAr: "للمتاجر الصغيرة", descriptionEn: "For small stores" },
  { code: "PROFESSIONAL", nameAr: "الاحترافي", nameEn: "Professional", priceMonthly: 49, staffLimit: 25, branchLimit: 10, productLimit: 5000, sortOrder: 2, descriptionAr: "للمتاجر المتنامية متعددة الفروع", descriptionEn: "For growing multi-branch retailers" },
  { code: "ENTERPRISE", nameAr: "المؤسسات", nameEn: "Enterprise", priceMonthly: 149, staffLimit: 1000, branchLimit: 1000, productLimit: 1000000, sortOrder: 3, descriptionAr: "بلا حدود لكل الفروع", descriptionEn: "Unlimited branches & scale" },
];
