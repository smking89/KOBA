import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "live" | "success" | "warning";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase",
        tone === "default" && "bg-surface-2 text-muted",
        tone === "live" && "bg-neon-lime/15 text-neon-lime",
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        className,
      )}
      {...props}
    />
  );
}
