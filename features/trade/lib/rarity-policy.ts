import type { ProductRarity } from "@/features/marketplace/lib/catalog";

/**
 * Owner rule: every item on both sides must share one rarity tier.
 * Rarity equality does not imply equal market value.
 */
export function assertSameRarityTrade(items: readonly { rarity: ProductRarity }[]): ProductRarity {
  if (items.length === 0) {
    throw new Error("EMPTY");
  }
  const tiers = new Set(items.map((item) => item.rarity));
  if (tiers.size !== 1) {
    throw new Error("MIXED_RARITY");
  }
  return items[0]!.rarity;
}

export const RARITY_VALUE_WARNING =
  "Items in the same rarity tier may still have different market values. Review every item before accepting.";
