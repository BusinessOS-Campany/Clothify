const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function fmtMoney(
  value: number | string | bigint | { toNumber(): number } | null | undefined,
): string {
  if (value == null) return "0";
  const n = typeof value === "object" ? value.toNumber() : Number(value);
  return moneyFmt.format(Number.isFinite(n) ? n : 0);
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "object" && "toNumber" in (value as object)) {
    return (value as { toNumber(): number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function fmtInt(value: number | bigint | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat("en-US").format(Number(value));
}

/** Round to 2 decimals avoiding floating point drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Format a monetary amount with the configured currency symbol.
 * Locale-aware (Arabic uses Arabic-Indic digits by default).
 */
export function formatPrice(
  value: number,
  currencySymbol: string,
  locale: "ar" | "en" = "en",
): string {
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const amount = nf.format(Number.isFinite(value) ? value : 0);
  return locale === "ar" ? `${amount} ${currencySymbol}` : `${currencySymbol}${amount}`;
}

export function fmtDate(d: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    dateStyle: "medium",
  }).format(d);
}

export function fmtDateTime(d: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function fmtTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}