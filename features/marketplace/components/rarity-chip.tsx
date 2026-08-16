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
        // self-start: this renders inside flex-col cards elsewhere in the
        // app, whose default align-items:stretch would otherwise stretch
        // this pill to the full card width instead of hugging its content.
        "inline-flex w-fit shrink-0 items-center self-start rounded-full border font-bold tracking-wide uppercase",
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
