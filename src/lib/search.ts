/**
 * Prisma search helpers.
 *
 * PostgreSQL `ILIKE` (Prisma `mode: "insensitive"`) raises
 * `invalid multibyte character for locale` (SQLSTATE 22021) under a `C`
 * collation when the query contains non-ASCII input. Arabic queries therefore
 * fall back to case-sensitive `LIKE`, which works for scripts with no casing.
 */
import type { Prisma } from "@/lib/generated/prisma/client";

export function textSearchMode(q: string): "insensitive" | undefined {
  return /^[\x00-\x7F]*$/.test(q) ? "insensitive" : undefined;
}

/**
 * Cross-field text search suitable for a `where` of ClientWhereInput /
 * SupplierWhereInput / ProductWhereInput etc. Returns a `{ OR: [...] }`
 * close so callers can spread it.
 */
export function genericTextSearch(
  q: string,
  fields: string[],
): Prisma.CustomerWhereInput {
  const mode = textSearchMode(q);
  const or: Prisma.CustomerWhereInput["OR"] = fields.map((f) => ({
    [f]: { contains: q, ...(mode ? { mode } : {}) },
  }));
  return { OR: or } as Prisma.CustomerWhereInput;
}

export function customerSearchOr(q: string): Prisma.CustomerWhereInput[] {
  const mode = textSearchMode(q);
  return [
    { name: { contains: q, ...(mode ? { mode } : {}) } },
    { nameAr: { contains: q } },
    { phone: { contains: q } },
    { email: { contains: q } },
  ];
}

export function productSearchOr(q: string): Prisma.ProductWhereInput[] {
  const mode = textSearchMode(q);
  return [
    { nameEn: { contains: q, ...(mode ? { mode } : {}) } },
    { nameAr: { contains: q } },
    { sku: { contains: q, ...(mode ? { mode } : {}) } },
    { barcode: { contains: q, ...(mode ? { mode } : {}) } },
  ];
}

export function supplierSearchOr(q: string): Prisma.SupplierWhereInput[] {
  const mode = textSearchMode(q);
  return [
    { name: { contains: q, ...(mode ? { mode } : {}) } },
    { nameAr: { contains: q } },
    { phone: { contains: q } },
    { email: { contains: q } },
    { contactName: { contains: q } },
  ];
}