import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-white/10 bg-white/[0.06] text-muted",
  success: "border-success/25 bg-success/[0.1] text-success",
  warning: "border-warning/25 bg-warning/[0.1] text-warning",
  danger: "border-destructive/25 bg-destructive/[0.1] text-destructive",
  accent: "border-neon-lime/25 bg-neon-lime/[0.08] text-neon-lime",
} as const;

const dots = {
  neutral: "bg-muted",
  success: "bg-success shadow-[0_0_6px_var(--color-success)]",
  warning: "bg-warning",
  danger: "bg-destructive",
  accent: "bg-neon-lime shadow-[0_0_6px_var(--color-neon-lime)]",
} as const;

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold tracking-[0.08em] uppercase",
        tones[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dots[tone])} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}
