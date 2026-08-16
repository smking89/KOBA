import { cn } from "@/lib/utils";

/**
 * Platform status pill (client reference, 2026-08-16: rounded pill,
 * bold white uppercase text, gradient fill) — green rather than the
 * brand's fire-red gradient, deliberately: a status badge reads faster
 * when it's a different hue than the primary brand accent.
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 px-2 py-0.5 text-[0.6rem] font-extrabold tracking-wide text-white uppercase shadow-soft",
        className,
      )}
    >
      Beta
    </span>
  );
}
