import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { key: string; className: string }> = {
  DRAFT: { key: "draft", className: "text-muted-foreground" },
  ORDERED: { key: "ordered", className: "border-blue-500/40 text-blue-600" },
  PARTIAL: { key: "partial", className: "border-amber-500/40 text-amber-600" },
  RECEIVED: { key: "received", className: "border-emerald-500/40 text-emerald-600" },
  CANCELLED: { key: "cancelled", className: "text-muted-foreground" },
};

export async function PoStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("purchasing");
  const meta = MAP[status] ?? { key: "draft", className: "" };
  return (
    <Badge variant="outline" className={meta.className}>
      {t(meta.key as "draft")}
    </Badge>
  );
}
