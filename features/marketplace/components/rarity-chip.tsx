import { Circle, Triangle, Diamond, Star, Sparkles, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RARITY_LABEL, type ProductRarity } from "@/features/marketplace/lib/catalog";

const rarityClass: Record<ProductRarity, string> = {
  COMMON: "text-rarity-common border-rarity-common/50 bg-rarity-common/10",
  UNCOMMON: "text-rarity-uncommon border-rarity-uncommon/50 bg-rarity-uncommon/10",
  RARE: "text-rarity-rare border-rarity-rare/50 bg-rarity-rare/10",
  EPIC: "text-rarity-epic border-rarity-epic/50 bg-rarity-epic/10",
  LEGENDARY: "text-rarity-legendary border-rarity-legendary/50 bg-rarity-legendary/10",
  RELIC:
    "text-rarity-relic border-rarity-relic/60 bg-rarity-relic/15 shadow-[0_0_14px_-4px_var(--color-rarity-relic)]",
};

const accentClass: Record<ProductRarity, string> = {
  COMMON: "border-t-rarity-common",
  UNCOMMON: "border-t-rarity-uncommon",
  RARE: "border-t-rarity-rare",
  EPIC: "border-t-rarity-epic",
  LEGENDARY: "border-t-rarity-legendary",
  RELIC: "border-t-rarity-relic",
};

/**
 * Escalating shape per tier (client request, 2026-08-16: rarity should
 * read as an icon, not a word) — a plain circle through an increasingly
 * ornate shape as rarity climbs, same convention as "shape = power" in
 * most loot-tier UIs. The legend explaining this lives at /settings so
 * the mapping isn't just implied.
 */
export const RARITY_ICON: Record<ProductRarity, LucideIcon> = {
  COMMON: Circle,
  UNCOMMON: Triangle,
  RARE: Diamond,
  EPIC: Star,
  LEGENDARY: Sparkles,
  RELIC: Crown,
};

export function RarityChip({
  rarity,
  showLabel = false,
  className,
}: {
  rarity: ProductRarity;
  /** Show the text label alongside the icon — off by default per the
   * client's "icon, not word" direction; used on the /settings legend
   * where the word is the point. */
  showLabel?: boolean;
  className?: string;
}) {
  const Icon = RARITY_ICON[rarity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase",
        rarityClass[rarity],
        className,
      )}
      title={RARITY_LABEL[rarity]}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {showLabel ? RARITY_LABEL[rarity] : <span className="sr-only">{RARITY_LABEL[rarity]}</span>}
    </span>
  );
}

export function rarityAccentClass(rarity: ProductRarity): string {
  return accentClass[rarity];
}
