import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("errors");
  const tc = await getTranslations("common");
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-destructive">403</p>
        <h1 className="text-2xl font-semibold">{t("forbiddenTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("forbiddenSubtitle")}
        </p>
      </div>
      <Button asChild>
        <Link href="/">{tc("backHome")}</Link>
      </Button>
    </div>
  );
}