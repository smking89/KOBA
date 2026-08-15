import type { CosmeticSubType, ProductRarity } from "@/features/marketplace/lib/catalog";

export type PublicCosmetic = {
  slug: string;
  name: string;
  description: string;
  subType: CosmeticSubType;
  rarity: ProductRarity;
  priceCents: number;
  currency: string;
  shop: { slug: string; name: string };
};
