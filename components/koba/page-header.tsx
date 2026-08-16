import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  eyebrowTone?: "default" | "live" | "success" | "warning";
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  eyebrowTone = "live",
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl space-y-2">
        {eyebrow ? (
          <Badge tone={eyebrowTone} dot={eyebrowTone === "live" || eyebrowTone === "success"}>
            {eyebrow}
          </Badge>
        ) : null}
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-balance md:text-[2rem] md:leading-tight">
          {title}
        </h1>
        {description ? (
          <div className="text-sm leading-relaxed text-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
