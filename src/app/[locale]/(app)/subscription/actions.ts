"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenantContext } from "@/core/tenant";
import { requirePermission, requireUser } from "@/core/auth/session";
import { subscriptionsInDevelopmentMode } from "@/core/subscriptions";
import { recordAudit } from "@/core/audit";
import type { SubscriptionPlanCode } from "@/lib/generated/prisma/client";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const PLAN_CODES: SubscriptionPlanCode[] = ["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

export async function changePlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireTenantContext();
  await requirePermission("subscription:read");
  const user = await requireUser();
  if (!user.isPlatformAdmin && ctx.roleCode !== "owner") return { error: "forbidden" };

  const code = String(formData.get("planCode") ?? "") as SubscriptionPlanCode;
  if (!PLAN_CODES.includes(code)) return { error: "invalid" };

  const plan = await prisma.subscriptionPlan.findUnique({ where: { code }, select: { id: true } });
  if (!plan) return { error: "invalid" };

  const dev = subscriptionsInDevelopmentMode();
  await prisma.subscription.update({
    where: { tenantId: ctx.tenantId },
    data: {
      planId: plan.id,
      development: dev,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      trialEndsAt: null,
      canceledAt: null,
    },
  });
  recordAudit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "update", entity: "Subscription", entityId: ctx.tenantId });
  revalidatePath("/subscription");
  return { ok: true };
}
