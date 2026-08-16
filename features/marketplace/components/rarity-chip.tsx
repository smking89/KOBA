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

const badgeSize: Record<"sm" | "md" | "lg", { pill: string; icon: number; iconClass: string }> = {
  sm: { pill: "gap-1 px-2 py-0.5 text-[0.65rem]", icon: 16, iconClass: "h-4 w-4" },
  md: { pill: "gap-1.5 px-2.5 py-1 text-xs", icon: 22, iconClass: "h-[22px] w-[22px]" },
  lg: { pill: "gap-2 px-3 py-1.5 text-sm", icon: 32, iconClass: "h-8 w-8" },
};

export function RarityChip({
  rarity,
  showLabel = false,
  size = "md",
  className,
}: {
  rarity: ProductRarity;
  /** Show the text label alongside the badge — off by default per the
   * client's "icon, not word" direction; used on the /settings legend
   * where the word is the point. */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pill, icon, iconClass } = badgeSize[size];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center self-start rounded-full border font-semibold tracking-[0.08em] uppercase",
        pill,
        rarityClass[rarity],
        className,
      )}
      title={RARITY_LABEL[rarity]}
    >
      <Image
        src={RARITY_ICON_SRC[rarity]}
        alt=""
        width={icon}
        height={icon}
        className={iconClass}
        aria-hidden
      />
      {showLabel ? RARITY_LABEL[rarity] : <span className="sr-only">{RARITY_LABEL[rarity]}</span>}
    </span>
  );
}

export function rarityAccentClass(rarity: ProductRarity): string {
  return accentClass[rarity];
}
