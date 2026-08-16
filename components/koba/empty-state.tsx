import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/10 bg-surface-3 px-5 py-12 text-center text-sm leading-relaxed text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
