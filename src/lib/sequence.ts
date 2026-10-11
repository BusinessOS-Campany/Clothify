import { prisma } from "@/lib/db";

export type SequenceKey =
  | "SALE"
  | "RECEIPT"
  | "REFUND"
  | "CUSTOMER"
  | "PO"
  | "GOODS"
  | "EXPENSE"
  | "TRANSFER"
  | "STOCKTAKE";

const DEFAULTS: Record<SequenceKey, { prefix: string; pad: number }> = {
  SALE: { prefix: "SALE", pad: 5 },
  RECEIPT: { prefix: "RCP", pad: 5 },
  REFUND: { prefix: "REF", pad: 5 },
  CUSTOMER: { prefix: "C", pad: 5 },
  PO: { prefix: "PO", pad: 5 },
  GOODS: { prefix: "GRN", pad: 5 },
  EXPENSE: { prefix: "EXP", pad: 5 },
  TRANSFER: { prefix: "TR", pad: 5 },
  STOCKTAKE: { prefix: "ST", pad: 5 },
};

/**
 * Allocates the next sequential document number for a tenant.
 * Uses an atomic upsert so concurrent requests can never receive the same
 * number (row-level increment inside a transaction).
 */
export async function nextNumber(
  tenantId: string,
  key: SequenceKey,
  overrides?: { prefix?: string; padLength?: number },
): Promise<string> {
  const def = DEFAULTS[key] ?? { prefix: "", pad: 5 };
  const prefix = overrides?.prefix ?? def.prefix;
  const padLength = overrides?.padLength ?? def.pad;

  const seq = await prisma.numberSequence.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: {
      tenantId,
      key,
      prefix,
      padLength,
      currentValue: 1,
    },
    update: {
      prefix,
      padLength,
      currentValue: { increment: 1 },
    },
    select: { currentValue: true, padLength: true, prefix: true, suffix: true },
  });

  return `${seq.prefix}${String(seq.currentValue).padStart(seq.padLength, "0")}${seq.suffix}`;
}

export async function peekNumber(
  tenantId: string,
  key: SequenceKey,
): Promise<string> {
  const def = DEFAULTS[key] ?? { prefix: "", pad: 5 };
  const seq = await prisma.numberSequence.findUnique({
    where: { tenantId_key: { tenantId, key } },
    select: { currentValue: true, padLength: true, prefix: true, suffix: true },
  });
  const currentValue = seq ? seq.currentValue + BigInt(1) : BigInt(1);
  return `${seq?.prefix ?? def.prefix}${String(currentValue).padStart(
    seq?.padLength ?? def.pad,
    "0",
  )}${seq?.suffix ?? ""}`;
}