import Image from "next/image";
import { cn } from "@/lib/utils";
import { RARITY_LABEL, type ProductRarity } from "@/features/marketplace/lib/catalog";

const rarityClass: Record<ProductRarity, string> = {
  COMMON: "border-rarity-common/30 bg-rarity-common/10 text-rarity-common",
  UNCOMMON: "border-rarity-uncommon/30 bg-rarity-uncommon/10 text-rarity-uncommon",
  RARE: "border-rarity-rare/30 bg-rarity-rare/10 text-rarity-rare",
  EPIC: "border-rarity-epic/30 bg-rarity-epic/10 text-rarity-epic",
  LEGENDARY: "border-rarity-legendary/30 bg-rarity-legendary/10 text-rarity-legendary",
  RELIC: "border-rarity-relic/40 bg-rarity-relic/12 text-rarity-relic",
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
        "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold tracking-[0.08em] uppercase",
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
