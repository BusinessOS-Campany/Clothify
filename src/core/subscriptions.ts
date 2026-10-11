import { prisma } from "@/lib/db";
import type {
  Prisma,
  SubscriptionPlanCode,
} from "@/lib/generated/prisma/client";

export class PlanLimitError extends Error {
  constructor(public kind: "STAFF" | "BRANCH" | "PRODUCT", message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type SubscriptionInfo = {
  planCode: SubscriptionPlanCode;
  planNameAr: string;
  planNameEn: string;
  status: string;
  development: boolean;
  staffLimit: number;
  branchLimit: number;
  productLimit: number;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
};

/**
 * Whether the platform runs subscriptions without a real payment provider.
 * DEVELOPMENT subscriptions are clearly labeled and can never be presented
 * as provider-confirmed payments.
 */
export function subscriptionsInDevelopmentMode(): boolean {
  return Boolean(
    !process.env.STRIPE_SECRET_KEY ||
      process.env.CLOTHIFY_SUBSCRIPTIONS_MODE === "development",
  );
}

export async function getSubscription(
  tenantId: string,
): Promise<SubscriptionInfo | null> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) return null;
  const dev = subscriptionsInDevelopmentMode() || sub.development;
  return {
    planCode: sub.plan.code,
    planNameAr: sub.plan.nameAr,
    planNameEn: sub.plan.nameEn,
    status: dev ? "DEVELOPMENT" : sub.status,
    development: dev,
    staffLimit: sub.plan.staffLimit,
    branchLimit: sub.plan.branchLimit,
    productLimit: sub.plan.productLimit,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
  };
}

/**
 * Server-side plan-limit enforcement. Throws when the tenant exceeded the
 * limits of its current plan. Called inside the same transaction that
 * creates/activates the resource so the check and the write are atomic.
 */
export async function assertPlanLimit(
  tenantId: string,
  kind: "STAFF" | "BRANCH" | "PRODUCT",
  tx: Prisma.TransactionClient = prisma,
) {
  const sub = await tx.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) return; // no subscription yet → onboarding phase, allow

  const counts = {
    STAFF: () => tx.tenantMember.count({ where: { tenantId } }),
    BRANCH: () => tx.branch.count({ where: { tenantId } }),
    PRODUCT: () => tx.product.count({ where: { tenantId } }),
  } as const;

  const count = await counts[kind]();
  const limit =
    kind === "STAFF"
      ? sub.plan.staffLimit
      : kind === "BRANCH"
        ? sub.plan.branchLimit
        : sub.plan.productLimit;

  if (count >= limit) {
    throw new PlanLimitError(
      kind,
      `Plan limit exceeded for ${kind}: ${count}/${limit}`,
    );
  }
}