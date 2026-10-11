import { getTranslations } from "next-intl/server";
import { BarChart3, ShieldCheck, Sparkles, Store } from "lucide-react";
import { BrandMark } from "@/components/brand";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  const features = [
    { icon: Store, label: t("feature1") },
    { icon: BarChart3, label: t("feature2") },
    { icon: Sparkles, label: t("feature3") },
  ];

  return (
    <div className="relative grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -start-16 bottom-[-6rem] size-80 rounded-full bg-sidebar-primary/15 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-11" />
          <span className="text-lg font-semibold tracking-tight">
            {tc("appName")}
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/70">
            {t("heroSubtitle")}
          </p>

          <ul className="mt-10 flex flex-col gap-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border">
                  <Icon className="size-4 text-sidebar-primary" aria-hidden />
                </span>
                <span className="text-sm text-sidebar-foreground/80">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/50">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t("trust")}
        </div>
      </aside>

      <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,var(--primary)/0.08,transparent)]" />
        <div className="relative flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <BrandMark className="size-12" />
            <p className="text-lg font-semibold">{tc("appName")}</p>
          </div>
          {children}
        </div>
        <p className="relative text-center text-xs text-muted-foreground">
          {t("copyright")}
        </p>
      </main>
    </div>
  );
}