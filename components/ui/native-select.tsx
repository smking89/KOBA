import * as React from "react";
import { cn } from "@/lib/utils";

export const nativeSelectClassName =
  "h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return <select ref={ref} className={cn(nativeSelectClassName, className)} {...props} />;
  },
);
NativeSelect.displayName = "NativeSelect";
