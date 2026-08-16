import { cn } from "@/lib/utils";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/**
 * Hexagon-framed avatar (client reference: Vikinger theme, 2026-08-16).
 * No real avatar-image upload feature exists yet, so this renders the
 * user's initial in a brand-gradient hex frame rather than a fake photo —
 * swap in a real <Image> once profile pictures ship.
 */
export function HexAvatar({
  name,
  size = "md",
  badge,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  /** Small label pinned to the bottom-right corner — e.g. a Plus tenure badge. */
  badge?: string | null;
  className?: string;
}) {
  const dimension = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-10 w-10" : "h-16 w-16";
  const textSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-xl";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("relative", dimension, className)}>
      <div className="h-full w-full bg-brand-gradient p-[3px]" style={{ clipPath: HEX_CLIP }}>
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-surface font-bold text-foreground",
            textSize,
          )}
          style={{ clipPath: HEX_CLIP }}
        >
          {initial}
        </div>
      </div>
      {badge ? (
        <span className="absolute -right-1 -bottom-1 rounded-full bg-neon-lime px-1.5 py-0.5 text-[0.6rem] font-bold whitespace-nowrap text-background shadow-soft">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
