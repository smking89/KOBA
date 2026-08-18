import { cn } from "@/lib/utils";

/**
 * Platform status pill (client reference, 2026-08-16: rounded pill,
 * bold white uppercase text) — a flat green rather than the brand
 * accent, deliberately: a status badge reads faster when it's a
 * different hue than the primary accent. Flat fill, not a gradient
 * (client, 2026-08-17: "let's forget the gradients").
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[0.6rem] font-extrabold tracking-wide text-white uppercase shadow-soft",
        className,
      )}
    >
      Beta
    </span>
  );
}
