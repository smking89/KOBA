import {
  Anchor,
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Boxes,
  Calendar,
  ClipboardCheck,
  Flag,
  Gavel,
  Gem,
  HandCoins,
  Landmark,
  Megaphone,
  Quote,
  Radio,
  Rocket,
  Rss,
  ShieldCheck,
  Swords,
  TrendingUp,
  Trophy,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeFrame, coinTones } from "@/features/achievements/components/badge-frame";
import { KobaPlusMark } from "@/components/koba/koba-plus-mark";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

// Named imports only (not `import * as icons`) — every icon used by a
// ACHIEVEMENT_CATALOG entry is listed here explicitly so bundlers can
// tree-shake the rest of lucide-react's ~1600 icons out of the client
// bundle. "koba-plus" is a sentinel handled separately below, not a
// lucide icon.
//
// None of these may duplicate an icon used anywhere in navigation
// (IconRail/AppSidebar/AppHeader/MobileNav), ProductActionRail, or the
// homepage feature grid — see the uniqueness rule in catalog.ts.
export const ICON_MAP: Record<string, LucideIcon> = {
  Anchor,
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Boxes,
  Calendar,
  ClipboardCheck,
  Flag,
  Gavel,
  Gem,
  HandCoins,
  Landmark,
  Megaphone,
  Quote,
  Radio,
  Rocket,
  Rss,
  ShieldCheck,
  Swords,
  TrendingUp,
  Trophy,
  Wallet,
  Warehouse,
};

const badgeSize: Record<"sm" | "md" | "lg", { frame: string; glyph: string; glyphPx: number; numeral: string }> = {
  sm: { frame: "h-12 w-12", glyph: "h-5 w-5", glyphPx: 20, numeral: "text-base" },
  md: { frame: "h-16 w-16", glyph: "h-7 w-7", glyphPx: 28, numeral: "text-xl" },
  lg: { frame: "h-24 w-24", glyph: "h-10 w-10", glyphPx: 40, numeral: "text-3xl" },
};

// One animation per tier, escalating with difficulty (client correction,
// 2026-08-17: "the harder icons need to have different animated
// effects" — a single glow shared by the top two tiers wasn't enough
// differentiation). Common/Uncommon stay static — they're meant to be
// unlocked in someone's first session, no reason to draw the eye.
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

/**
 * Engraved-in-the-coin treatment (client correction, 2026-08-17: the
 * KOBA Plus mark should be "built into the actual badge art... just like
 * Discord did there badges", not a separately-colored sticker glued on
 * top) — a light offset copy sits under a dark main copy, both tinted to
 * the coin's own tier tones, giving a real carved-relief look instead of
 * a flat external color.
 */
function Emboss({ rarity, children }: { rarity: ProductRarity; children: React.ReactNode }) {
  const { dark, light } = coinTones(rarity);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute" style={{ color: light, transform: "translate(-0.5px,-0.5px)" }}>
        {children}
      </div>
      <div className="relative" style={{ color: dark }}>
        {children}
      </div>
    </div>
  );
}

export function AchievementBadge({
  name,
  description,
  rarity,
  icon,
  numeral,
  unlocked,
  size = "md",
  className,
}: {
  name: string;
  description: string;
  rarity: ProductRarity;
  /** lucide-react icon name, or "koba-plus" to emboss the real KOBA Plus mark. */
  icon: string;
  /** Ladder rank (1-based) — rendered as a bold embossed number instead
   * of the icon when set, so same-rarity same-icon ladder rungs stay
   * visually distinct. */
  numeral?: number | undefined;
  /** Locked badges render greyed-out and inert (Discord-style "you haven't
   * earned this yet" preview) rather than being hidden entirely. */
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { frame, glyph, glyphPx, numeral: numeralClass } = badgeSize[size];
  const isPlusMark = icon === "koba-plus";

  return (
    <div
      className={cn("group relative flex flex-col items-center gap-1.5", className)}
      title={unlocked ? `${name} — ${description}` : `Locked — ${description}`}
    >
      <div className={cn("relative shrink-0", frame, !unlocked && "opacity-35 grayscale")}>
        <BadgeFrame
          rarity={rarity}
          size={glyphPx * 3}
          className={cn("h-full w-full", unlocked && tierEffectClass[rarity])}
        />
        <Emboss rarity={rarity}>
          {isPlusMark ? (
            <KobaPlusMark size={glyphPx * 1.1} tone="mono" />
          ) : numeral !== undefined ? (
            <span className={cn("font-mono font-extrabold", numeralClass)}>{numeral}</span>
          ) : (
            (() => {
              const Icon = resolveIcon(icon);
              return <Icon aria-hidden className={glyph} strokeWidth={2.5} />;
            })()
          )}
        </Emboss>
      </div>
      <span className="sr-only">{unlocked ? name : `${name} (locked)`}</span>
    </div>
  );
}
