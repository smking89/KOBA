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
        "inline-flex items-center gap-1.5 rounded-full border border-neon-lime/30 bg-neon-lime/[0.1] font-semibold tracking-[0.08em] text-neon-lime uppercase",
        size === "sm" ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neon-lime text-[9px] leading-none text-background"
      >
        ★
      </span>
      <span>KOBA Plus</span>
    </span>
  );
}
