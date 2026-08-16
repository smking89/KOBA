import { cn } from "@/lib/utils";

type PlusBadgeProps = {
  visible: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function PlusBadge({ visible, className, size = "sm" }: PlusBadgeProps) {
  if (!visible) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-neon-lime/12 font-semibold tracking-wide text-neon-lime uppercase",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        className,
      )}
    >
      <span aria-hidden="true">★</span>
      <span>KOBA Plus</span>
    </span>
  );
}
