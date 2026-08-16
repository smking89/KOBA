import Image from "next/image";
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
 * Client-supplied rarity badge marks (2026-08-16, public/brand/rarity/) —
 * the same crest shape per tier, recolored gray → green → blue → purple
 * → orange/gold → red, matching the existing rarity-* color tokens
 * exactly (common=gray, uncommon=green, rare=blue, epic=purple,
 * legendary=orange, relic=red). Replaces the earlier lucide-icon
 * placeholder approximation.
 */
export const RARITY_ICON_SRC: Record<ProductRarity, string> = {
  COMMON: "/brand/rarity/common.png",
  UNCOMMON: "/brand/rarity/uncommon.png",
  RARE: "/brand/rarity/rare.png",
  EPIC: "/brand/rarity/epic.png",
  LEGENDARY: "/brand/rarity/legendary.png",
  RELIC: "/brand/rarity/relic.png",
};

export function RarityChip({
  rarity,
  showLabel = false,
  className,
}: {
  rarity: ProductRarity;
  /** Show the text label alongside the badge — off by default per the
   * client's "icon, not word" direction; used on the /settings legend
   * where the word is the point. */
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase",
        rarityClass[rarity],
        className,
      )}
      title={RARITY_LABEL[rarity]}
    >
      <Image
        src={RARITY_ICON_SRC[rarity]}
        alt=""
        width={12}
        height={12}
        className="h-3 w-3"
        aria-hidden
      />
      {showLabel ? RARITY_LABEL[rarity] : <span className="sr-only">{RARITY_LABEL[rarity]}</span>}
    </span>
  );
}

export function rarityAccentClass(rarity: ProductRarity): string {
  return accentClass[rarity];
}
