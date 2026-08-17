import Image from "next/image";
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
import { RARITY_ICON_SRC } from "@/features/marketplace/components/rarity-chip";
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

// Same six-tier color scale as the marketplace rarity chips
// (features/marketplace/components/rarity-chip.tsx) — the glyph overlay is
// tinted to match its crest instead of a flat white, and only the two
// hardest-to-earn tiers get an animated glow (client spec: "the harder to
// earn badges need animated effects").
const glyphColorClass: Record<ProductRarity, string> = {
  COMMON: "text-rarity-common",
  UNCOMMON: "text-rarity-uncommon",
  RARE: "text-rarity-rare",
  EPIC: "text-rarity-epic",
  LEGENDARY: "text-rarity-legendary",
  RELIC: "text-rarity-relic",
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
        <Image
          src={RARITY_ICON_SRC[rarity]}
          alt=""
          width={glyphPx * 3}
          height={glyphPx * 3}
          className={cn("h-full w-full object-contain", unlocked && glowClass[rarity])}
          aria-hidden
        />
        <Icon
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            glyph,
            unlocked ? glyphColorClass[rarity] : "text-muted",
          )}
          strokeWidth={2.25}
        />
      </div>
      <span className="sr-only">{unlocked ? name : `${name} (locked)`}</span>
    </div>
  );
}
