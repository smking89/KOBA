import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pointed-end ribbon banner — the black chevron/hex bar used for the
 * title and seller rows on the TCG-style product card (client reference,
 * 2026-08-17, exact-match request).
 */
export function CardBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-11 w-full shrink-0 items-center justify-center bg-black px-8 text-center",
        className,
      )}
      style={{
        clipPath:
          "polygon(3% 0%, 97% 0%, 100% 50%, 97% 100%, 3% 100%, 0% 50%)",
      }}
    >
      {children}
    </div>
  );
}
