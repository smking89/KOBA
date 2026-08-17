import type {
  FreebiePolicy,
  GamePlatform,
  ListingType,
  ProductRarity,
} from "@/features/marketplace/lib/catalog";

export type PublicSeller = {
  displayName: string;
  handle: string | null;
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
  /** First ProductMedia row (by sortOrder), or null when the seller hasn't
   * uploaded any media yet — real data, never a stand-in image URL. */
  thumbnailUrl: string | null;
  thumbnailKind: "IMAGE" | "VIDEO";
  favorited: boolean;
  /** Private wishlist state (ProductSave) for the viewing user — false for
   * signed-out visitors, never a public count. */
  saved: boolean;
  auction: PublicAuctionSummary | null;
  /** True while an active Boost (features/boost) targets this product. */
  boosted: boolean;
  freebiePolicy: FreebiePolicy;
  /** Short excerpt of the full description — card "flavor text". */
  descriptionSnippet: string;
  /** From the selling Shop's real reviews (ShopReview) — null with no reviews yet, never fabricated. */
  shopRatingAvg: number | null;
  shopReviewCount: number;
  /** Real ProductFavorite count — the "like" count. */
  favoriteCount: number;
  /** Real ProductComment count (moderationStatus LIVE only). */
  commentCount: number;
};

export type PublicProductDetail = PublicProductCard & {
  description: string;
  inventoryQty: number;
  variants: { sku: string; name: string; priceCents: number; inventoryQty: number }[];
  media: { url: string; alt: string; kind: "IMAGE" | "VIDEO" }[];
  /** True when the signed-in viewer has already claimed this freebie. */
  freebieClaimed: boolean;
};

export type PublicProductComment = {
  publicRef: string;
  body: string;
  createdAt: string;
  author: { name: string; handle: string | null; kobaId: string | null };
};
