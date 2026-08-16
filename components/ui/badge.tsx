import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  default: "border-white/10 bg-white/[0.06] text-muted",
  live: "border-neon-lime/25 bg-neon-lime/[0.08] text-neon-lime",
  success: "border-success/25 bg-success/[0.1] text-success",
  warning: "border-warning/25 bg-warning/[0.1] text-warning",
  danger: "border-destructive/25 bg-destructive/[0.1] text-destructive",
} as const;

const dots = {
  default: "bg-muted",
  live: "bg-neon-lime shadow-[0_0_6px_var(--color-neon-lime)]",
  success: "bg-success shadow-[0_0_6px_var(--color-success)]",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

export type BadgeTone = keyof typeof tones;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
};

export function Badge({
  className,
  tone = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold tracking-[0.08em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dots[tone])} aria-hidden />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
