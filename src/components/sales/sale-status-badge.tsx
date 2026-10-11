import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { key: string; className: string }> = {
  COMPLETED: { key: "completed", className: "border-emerald-500/40 text-emerald-600" },
  CANCELLED: { key: "cancelled", className: "text-muted-foreground" },
  PARTIALLY_REFUNDED: { key: "partiallyRefunded", className: "border-amber-500/40 text-amber-600" },
  REFUNDED: { key: "refunded", className: "border-blue-500/40 text-blue-600" },
};

export async function SaleStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("sales");
  const meta = MAP[status] ?? { key: "completed", className: "" };
  return (
    <Badge variant="outline" className={meta.className}>
      {t(meta.key as "completed")}
    </Badge>
  );
}
