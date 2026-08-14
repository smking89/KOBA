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

export function RarityChip({ rarity, className }: { rarity: ProductRarity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase",
        rarityClass[rarity],
        className,
      )}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

export function rarityAccentClass(rarity: ProductRarity): string {
  return accentClass[rarity];
}
