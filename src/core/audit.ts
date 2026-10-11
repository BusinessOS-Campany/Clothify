import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "refund"
  | "void"
  | "login"
  | "logout"
  | "receive"
  | "transfer"
  | "adjust"
  | "export"
  | "print";

export type AuditContext = {
  tenantId: string;
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Records an audit entry. Fire-and-forget so a failed audit write never
 * breaks the primary operation; failures are logged, not thrown.
 */
export function recordAudit(ctx: AuditContext) {
  void prisma.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: ctx.action,
        entity: ctx.entity,
        entityId: ctx.entityId ?? null,
        metadata: (ctx.metadata ?? undefined) as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    })
    .catch((err) => {
      console.warn("[audit] failed to persist:", err);
    });
}