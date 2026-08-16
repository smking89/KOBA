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

export function RarityChip({ rarity, className }: { rarity: ProductRarity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold tracking-[0.08em] uppercase",
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
