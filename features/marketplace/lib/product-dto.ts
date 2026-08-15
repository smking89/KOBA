import type { GamePlatform, ListingType, ProductRarity } from "@/features/marketplace/lib/catalog";

export type PublicSeller = {
  displayName: string;
  kobaId: string | null;
  shopSlug: string | null;
  verified: boolean;
};

export type PublicAuctionSummary = {
  status: string;
  endsAt: string;
  highBidCents: number | null;
  minIncrementCents: number;
};

export type PublicProductCard = {
  slug: string;
  title: string;
  rarity: ProductRarity;
  listingType: ListingType;
  priceCents: number;
  currency: string;
  inStock: boolean;
  platforms: GamePlatform[];
  game: { slug: string; name: string };
  category: { slug: string; name: string };
  seller: PublicSeller;
  thumbnailAlt: string;
  favorited: boolean;
  auction: PublicAuctionSummary | null;
  /** True while an active Boost (features/boost) targets this product. */
  boosted: boolean;
};

export type PublicProductDetail = PublicProductCard & {
  description: string;
  inventoryQty: number;
  variants: { sku: string; name: string; priceCents: number; inventoryQty: number }[];
  media: { url: string; alt: string; kind: "IMAGE" | "VIDEO" }[];
};
