import {
  Award,
  BadgeCheck,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  Crown,
  Flag,
  Gem,
  Handshake,
  Heart,
  MessageCircle,
  Repeat,
  Sparkles,
  Star,
  Store,
  ShoppingBag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeFrame } from "@/features/achievements/components/badge-frame";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

// Named imports only (not `import * as icons`) — every icon used by
// ACHIEVEMENT_CATALOG (features/achievements/lib/catalog.ts) is listed here
// explicitly so bundlers can tree-shake the rest of lucide-react's ~1600
// icons out of the client bundle. AchievementBadge is reachable from a
// client component (AchievementConfetti), so this directly controls
// /u/[handle]'s shipped JS size — add new icons to this map when adding a
// catalog entry, don't reach for a barrel import.
export const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  BadgeCheck,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  Crown,
  Flag,
  Gem,
  Handshake,
  Heart,
  MessageCircle,
  Repeat,
  Sparkles,
  Star,
  Store,
  ShoppingBag,
  TrendingUp,
  Users,
};

const badgeSize: Record<"sm" | "md" | "lg", { frame: string; glyph: string; glyphPx: number }> = {
  sm: { frame: "h-12 w-12", glyph: "h-5 w-5", glyphPx: 20 },
  md: { frame: "h-16 w-16", glyph: "h-7 w-7", glyphPx: 28 },
  lg: { frame: "h-24 w-24", glyph: "h-10 w-10", glyphPx: 40 },
};

const glowClass: Record<ProductRarity, string> = {
  COMMON: "",
  UNCOMMON: "",
  RARE: "",
  EPIC: "",
  LEGENDARY: "animate-badge-glow drop-shadow-[0_0_10px_rgba(255,182,72,0.55)]",
  RELIC: "animate-badge-glow drop-shadow-[0_0_12px_rgba(255,36,105,0.6)]",
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Award;
}

export function AchievementBadge({
  name,
  description,
  rarity,
  icon,
  unlocked,
  size = "md",
  className,
}: {
  name: string;
  description: string;
  rarity: ProductRarity;
  icon: string;
  /** Locked badges render greyed-out and inert (Discord-style "you haven't
   * earned this yet" preview) rather than being hidden entirely. */
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = resolveIcon(icon);
  const { frame, glyph, glyphPx } = badgeSize[size];

  return (
    <div
      className={cn("group relative flex flex-col items-center gap-1.5", className)}
      title={unlocked ? `${name} — ${description}` : `Locked — ${description}`}
    >
      <div className={cn("relative shrink-0", frame, !unlocked && "opacity-35 grayscale")}>
        <BadgeFrame
          rarity={rarity}
          size={glyphPx * 3}
          className={cn("h-full w-full", unlocked && glowClass[rarity])}
        />
        <Icon
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]",
            glyph,
          )}
          strokeWidth={2.5}
        />
      </div>
      <span className="sr-only">{unlocked ? name : `${name} (locked)`}</span>
    </div>
  );
}
