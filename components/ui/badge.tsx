import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "live" | "success" | "warning";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded px-1.5 text-[11px] font-semibold tracking-wide uppercase",
        tone === "default" && "bg-white/8 text-muted",
        tone === "live" && "bg-neon-lime/12 text-neon-lime",
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        className,
      )}
      {...props}
    />
  );
}
