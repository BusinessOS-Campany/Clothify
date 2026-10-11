import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { key: string; className: string }> = {
  PENDING: { key: "pending", className: "border-amber-500/40 text-amber-600" },
  IN_TRANSIT: { key: "inTransit", className: "border-blue-500/40 text-blue-600" },
  IN_PROGRESS: { key: "inTransit", className: "border-blue-500/40 text-blue-600" },
  COMPLETED: { key: "completed", className: "border-emerald-500/40 text-emerald-600" },
  CANCELLED: { key: "cancelled", className: "text-muted-foreground" },
  DRAFT: { key: "pending", className: "text-muted-foreground" },
};

export async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("inventory");
  const meta = MAP[status] ?? { key: "pending", className: "" };
  const label = (["pending", "inTransit", "completed", "cancelled"] as const).includes(
    meta.key as "pending",
  )
    ? t(meta.key as "pending")
    : status;
  return (
    <Badge variant="outline" className={meta.className}>
      {label}
    </Badge>
  );
}
