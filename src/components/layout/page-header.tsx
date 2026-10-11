import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  const Icon = icon;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex size-10 items-center justify-center rounded-xl border bg-card shadow-sm">
              <Icon className="size-5 text-primary" aria-hidden />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}