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
        "inline-flex items-center gap-1 rounded-full border border-neon-lime/40 bg-neon-lime/10 font-bold uppercase tracking-wide text-neon-lime",
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span aria-hidden="true">★</span>
      <span>KOBA Plus</span>
    </span>
  );
}
