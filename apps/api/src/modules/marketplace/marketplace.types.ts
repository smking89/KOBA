/**
 * Six-tier rarity ladder — matches design/ui-ux-design-system.html's
 * `.rarity-chip` classes exactly (common/uncommon/rare/epic/legendary/
 * relic). Do not add/rename tiers without updating that design file too.
 */
export enum RarityTier {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
  RELIC = 'relic',
}

export const RARITY_TIERS: readonly RarityTier[] = [
  RarityTier.COMMON,
  RarityTier.UNCOMMON,
  RarityTier.RARE,
  RarityTier.EPIC,
  RarityTier.LEGENDARY,
  RarityTier.RELIC,
];

/**
 * Listing categories. `COSMETIC` is the one category that additionally
 * requires a `cosmeticType` (see CosmeticType below) — the other four are
 * game-tradeable items and must NOT carry a cosmeticType.
 */
export enum ProductCategory {
  SKIN = 'skin',
  MAP = 'map',
  MONUMENT = 'monument',
  ASSET = 'asset',
  COSMETIC = 'cosmetic',
}

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  ProductCategory.SKIN,
  ProductCategory.MAP,
  ProductCategory.MONUMENT,
  ProductCategory.ASSET,
  ProductCategory.COSMETIC,
];

/**
 * Cosmetics are pre-made and sold, never built by the buyer (ROADMAP.md
 * Phase 0/9). Exactly these three sub-types — no "profile frames", no
 * "packs" (packs are a checkout-time bundle of existing products, per
 * ROADMAP Phase 9, not a product category).
 */
export enum CosmeticType {
  AVATAR_DECORATION = 'avatarDecoration',
  PROFILE_EFFECT = 'profileEffect',
  NAMEPLATE = 'nameplate',
}

export const COSMETIC_TYPES: readonly CosmeticType[] = [
  CosmeticType.AVATAR_DECORATION,
  CosmeticType.PROFILE_EFFECT,
  CosmeticType.NAMEPLATE,
];

/**
 * Small allowlist sample, not an exhaustive enum — see README.md
 * "Supported games". Kept as a plain string array (not a TS enum) so
 * adding a game later is additive, but still gives us a typed rejection
 * for obvious typos/garbage input.
 */
export const SUPPORTED_GAMES: readonly string[] = [
  'Rust',
  'Minecraft Java',
  'ARK: Survival Ascended',
  'ARK: Survival Evolved',
  'DayZ',
  '7 Days to Die',
  'Conan Exiles',
  'Valheim',
  'Unturned',
  "Garry's Mod",
  'S&Box',
  'Project Zomboid',
  'Eco',
  'Terraria',
  'Starbound',
  'Rust Console Edition',
  'ARK: Survival Evolved (Console)',
  'ARK: Survival Ascended (Console)',
  'Conan Exiles (Console)',
  '7 Days to Die (Console)',
  'Minecraft Bedrock',
];

/**
 * A marketplace listing. Immutable once created for every field except
 * `delisted` — delisting is a soft toggle (order history stays intact),
 * there is deliberately no hard-delete method anywhere in this module.
 */
export interface Product {
  readonly id: string;
  /** KOBAID (fullId) of the seller — a Business or Player KOBAID. */
  readonly sellerId: string;
  readonly title: string;
  readonly description: string;
  readonly game: string;
  readonly category: ProductCategory;
  readonly rarity: RarityTier;
  /** Integer cents. Never a float, anywhere in this module. */
  readonly priceCents: number;
  /** Only set when category === COSMETIC; null otherwise. */
  readonly cosmeticType: CosmeticType | null;
  readonly delisted: boolean;
  readonly createdAt: Date;
}

export interface CreateProductParams {
  sellerId: string;
  title: string;
  description: string;
  game: string;
  category: ProductCategory;
  rarity: RarityTier;
  priceCents: number;
  cosmeticType?: CosmeticType | null;
}

export enum AuctionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
}

/** One active auction per product at a time — enforced by AuctionService. */
export interface Auction {
  readonly id: string;
  readonly productId: string;
  /** Denormalized from Product at start time — used for the
   * seller-cannot-bid-own-auction check without an extra lookup. */
  readonly sellerId: string;
  readonly startPriceCents: number;
  readonly minIncrementCents: number;
  readonly endsAt: Date;
  readonly status: AuctionStatus;
  readonly createdAt: Date;
}

export interface StartAuctionParams {
  productId: string;
  startPriceCents: number;
  minIncrementCents: number;
  endsAt: Date;
}

export interface Bid {
  readonly id: string;
  readonly auctionId: string;
  readonly bidderKobaId: string;
  readonly amountCents: number;
  readonly placedAt: Date;
}

export interface PlaceBidParams {
  auctionId: string;
  bidderKobaId: string;
  amountCents: number;
}

export enum OrderSource {
  DIRECT = 'direct',
  AUCTION = 'auction',
}

/** A completed purchase — either a direct Buy or a won-auction settlement. */
export interface Order {
  readonly id: string;
  readonly productId: string;
  readonly buyerKobaId: string;
  readonly sellerKobaId: string;
  readonly amountCents: number;
  readonly createdAt: Date;
  readonly source: OrderSource;
}

export interface BuyProductParams {
  productId: string;
  buyerKobaId: string;
}
