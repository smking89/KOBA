import {
  Anchor,
  Award,
  BadgeCheck,
  ClipboardCheck,
  Flag,
  Gavel,
  Gem,
  HandCoins,
  Landmark,
  Megaphone,
  Quote,
  Radio,
  Rss,
  ShieldCheck,
  Swords,
  TrendingUp,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeFrame } from "@/features/achievements/components/badge-frame";
import { KobaPlusMark } from "@/components/koba/koba-plus-mark";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

// Named imports only (not `import * as icons`) — every icon used by a
// procedural (no real-art) ACHIEVEMENT_CATALOG entry is listed here
// explicitly so bundlers can tree-shake the rest of lucide-react's ~1600
// icons out of the client bundle. Ladder badges (account age, trade
// volume, collector, Boost rank, Plus tenure) render real art via
// `image` instead — see public/brand/achievements/ — and don't need an
// icon here at all.
//
// None of these may duplicate an icon used anywhere in navigation
// (IconRail/AppSidebar/AppHeader/MobileNav), ProductActionRail, or the
// homepage feature grid — see the uniqueness rule in catalog.ts.
export const ICON_MAP: Record<string, LucideIcon> = {
  Anchor,
  Award,
  BadgeCheck,
  ClipboardCheck,
  Flag,
  Gavel,
  Gem,
  HandCoins,
  Landmark,
  Megaphone,
  Quote,
  Radio,
  Rss,
  ShieldCheck,
  Swords,
  TrendingUp,
  Wallet,
  Warehouse,
};

const badgeSize: Record<"sm" | "md" | "lg", { frame: string; glyph: string; glyphPx: number }> = {
  sm: { frame: "h-12 w-12", glyph: "h-5 w-5", glyphPx: 20 },
  md: { frame: "h-16 w-16", glyph: "h-7 w-7", glyphPx: 28 },
  lg: { frame: "h-24 w-24", glyph: "h-10 w-10", glyphPx: 40 },
};

// One animation per tier, escalating with difficulty (client correction,
// 2026-08-17: "the harder icons need to have different animated
// effects" — a single glow shared by the top two tiers wasn't enough
// differentiation). Common/Uncommon stay static — they're meant to be
// unlocked in someone's first session, no reason to draw the eye. Applied
// to both the procedural frame and real badge art.
const tierEffectClass: Record<ProductRarity, string> = {
  COMMON: "",
  UNCOMMON: "",
  RARE: "animate-badge-shimmer",
  EPIC: "animate-badge-pulse drop-shadow-[0_0_8px_rgba(180,81,240,0.45)]",
  LEGENDARY: "animate-badge-glow drop-shadow-[0_0_10px_rgba(255,182,72,0.55)]",
  RELIC: "animate-badge-relic drop-shadow-[0_0_12px_rgba(255,36,105,0.6)]",
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Award;
}

export function AchievementBadge({
  name,
  description,
  rarity,
  icon,
  image,
  overlay,
  unlocked,
  size = "md",
  className,
}: {
  name: string;
  description: string;
  rarity: ProductRarity;
  /** lucide-react icon name — ignored when `image` is set. */
  icon: string;
  /** Real badge art (public/brand/achievements/*.svg) — takes priority
   * over the procedural gem frame + icon when present. */
  image?: string | undefined;
  /** Composites the real KOBA Plus mark over `image`. */
  overlay?: "koba-plus" | undefined;
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
        {image ? (
          <>
            {/* Real reference-style badge art (public/brand/achievements/)
                — flat/gradient SVG, not the procedural gem frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              aria-hidden
              className={cn("h-full w-full object-contain", unlocked && tierEffectClass[rarity])}
            />
            {overlay === "koba-plus" ? (
              <KobaPlusMark
                size={glyphPx * 1.05}
                className="absolute right-[8%] bottom-[8%] drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]"
              />
            ) : null}
          </>
        ) : (
          <>
            <BadgeFrame
              rarity={rarity}
              size={glyphPx * 3}
              className={cn("h-full w-full", unlocked && tierEffectClass[rarity])}
            />
            <Icon
              aria-hidden
              className={cn(
                // Warm gold/cream instead of flat white (client correction,
                // 2026-08-17: "white icons... hard to see and looks bad") —
                // reads as an inlaid metal emblem against any gem color, and
                // the dark drop-shadow gives real contrast instead of a
                // flat sticker look.
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#fff3d0] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
                glyph,
              )}
              strokeWidth={2.5}
            />
          </>
        )}
      </div>
      <span className="sr-only">{unlocked ? name : `${name} (locked)`}</span>
    </div>
  );
}
