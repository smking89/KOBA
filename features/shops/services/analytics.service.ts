import { PRODUCT_RARITIES, type ProductRarity } from "@/features/marketplace/lib/catalog";

export type RarityDistribution = Record<ProductRarity, number>;

/**
 * Pure function: given a shop's products, return the percentage breakdown
 * of the catalog by rarity (each value rounded to 2 decimal places; values
 * sum to ~100 for a non-empty catalog). No DB access — easy to unit test.
 * Live-computed on every analytics read; there is no rollup job/snapshot
 * table for this (known simplification, matches the rest of
 * getShopAnalytics, which is also live-queried, not precomputed).
 */
export function rarityDistribution(products: { rarity: ProductRarity }[]): RarityDistribution {
  const counts: Record<ProductRarity, number> = {
    COMMON: 0,
    UNCOMMON: 0,
    RARE: 0,
    EPIC: 0,
    LEGENDARY: 0,
    RELIC: 0,
  };

  for (const product of products) {
    counts[product.rarity] += 1;
  }

  const total = products.length;
  const distribution = {} as RarityDistribution;
  for (const rarity of PRODUCT_RARITIES) {
    distribution[rarity] = total === 0 ? 0 : Math.round((counts[rarity] / total) * 10000) / 100;
  }
  return distribution;
}
