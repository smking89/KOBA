import { cn } from "@/lib/utils";
import { KobaBadgeArt } from "@/components/koba/koba-badge-art";

type PlusBadgeProps = {
  visible: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function PlusBadge({ visible, className, size = "sm" }: PlusBadgeProps) {
  if (!visible) return null;

  const icon = size === "sm" ? 16 : 20;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-neon-lime/30 bg-black/40 font-semibold tracking-[0.08em] text-neon-lime uppercase",
        size === "sm" ? "h-6 pr-2 pl-1 text-[10px]" : "h-7 pr-2.5 pl-1 text-[11px]",
        className,
      )}
    >
      <KobaBadgeArt mark="plus" size={icon} />
      <span>KOBA Plus</span>
    </span>
  );
}
