export const PRODUCT_RARITIES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "RELIC",
] as const;

export type ProductRarity = (typeof PRODUCT_RARITIES)[number];

export const RARITY_RANK: Record<ProductRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  RELIC: 6,
};

export const RARITY_LABEL: Record<ProductRarity, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
  RELIC: "Relic",
};

export const GAME_PLATFORMS = ["PC", "STEAM", "XBOX", "PLAYSTATION"] as const;
export type GamePlatform = (typeof GAME_PLATFORMS)[number];

export const PLATFORM_LABEL: Record<GamePlatform, string> = {
  PC: "PC",
  STEAM: "Steam",
  XBOX: "Xbox",
  PLAYSTATION: "PlayStation",
};

export const COSMETIC_SUB_TYPES = [
  "AVATAR_DECORATION",
  "PROFILE_EFFECT",
  "NAMEPLATE",
  "PROFILE_FRAME",
  "SHOP_BANNER",
  "EMOJI",
] as const;
export type CosmeticSubType = (typeof COSMETIC_SUB_TYPES)[number];

export const COSMETIC_SUB_TYPE_LABEL: Record<CosmeticSubType, string> = {
  AVATAR_DECORATION: "Avatar decoration",
  PROFILE_EFFECT: "Profile effect",
  NAMEPLATE: "Nameplate",
  PROFILE_FRAME: "Profile frame",
  SHOP_BANNER: "Shop banner",
  EMOJI: "Emoji",
};

export const CATEGORY_KINDS = [
  "SKINS",
  "MAPS",
  "MONUMENTS",
  "KITS",
  "COSMETICS",
  "SERVER_ASSETS",
] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const LISTING_TYPES = ["FIXED", "AUCTION"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const FREEBIE_POLICIES = ["NONE", "PERMANENT", "LIMITED_QUANTITY"] as const;
export type FreebiePolicy = (typeof FREEBIE_POLICIES)[number];

export const MODERATION_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MARKET_SORTS = ["newest", "price_asc", "price_desc", "rarity"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];

export const PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function isPubliclyListed(input: {
  moderationStatus: ModerationStatus;
  publishedAt: Date | null;
}): boolean {
  return input.moderationStatus === "APPROVED" && input.publishedAt !== null;
}
