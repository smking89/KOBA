import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Metric-card kit for staff/business/influencer dashboards — the
 * client's TailAdmin-reskin request (2026-08-18), restyled to KOBA's
 * existing dark-first monochrome brand tokens (bg-surface-3,
 * text-neon-lime, etc. — the same palette every other page already
 * uses) rather than TailAdmin's own colors, per the client's own
 * confirmed direction. Built as a real component, not a port of
 * TailAdmin's static HTML: icon chip + big tabular number + label,
 * with an optional tone badge for a queue depth or trend.
 */
const TONE_CHIP: Record<"default" | "warning" | "danger" | "success", string> = {
  default: "bg-neon-lime/10 text-neon-lime",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  className,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-surface-3 p-5 shadow-soft",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-white/12",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              TONE_CHIP[tone],
            )}
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      {hint ? <p className="mt-2 text-xs text-muted/80">{hint}</p> : null}
    </div>
  );
}

/** Row layout for a group of StatCards — 2/3/4-up responsive grid,
 * matching TailAdmin's dashboard metric-row density without copying
 * its markup. */
export function StatCardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>
  );
}
