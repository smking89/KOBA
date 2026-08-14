/**
 * A shop profile. `id`/`ownerKobaId`/`createdAt` are immutable once
 * created — same "no update path for identity-defining fields" pattern
 * as `kobaid/kobaid.types.ts`'s `KobaId`. Unlike KobaId, though, a shop
 * *profile* (name/bio/banner/avatar) is meant to be updated — see
 * `ShopService#updateProfile()` — so this is deliberately NOT a fully
 * immutable interface the way `KobaId` is.
 */
export interface Shop {
  readonly id: string;
  /** Immutable once set. Must be a Business-role (`BZ`) KOBAID — see
   * `ShopService#createShop()`. */
  readonly ownerKobaId: string;
  readonly name: string;
  readonly bio: string;
  readonly bannerUrl: string | null;
  readonly avatarUrl: string | null;
  /** Owner-controlled, defaults to `true` — Phase 6's shop-level tagging
   * analogue (see `accounts/tagging-permission.service.ts` for the
   * role-level equivalent). No enforcement here, just the flag + query
   * method; real tag enforcement is Phase 6. */
  readonly allowTagging: boolean;
  /** Owner-controlled influencer-eligibility flag. Config only — referral
   * code generation/payout execution is Phase 10 (Influencer System). */
  readonly promoEligible: boolean;
  /** Null until the owner configures a payout rate via
   * `ShopPromoService#setPromoSettings()`. */
  readonly promoPayout: PromoPayoutConfig | null;
  readonly createdAt: Date;
}

export interface CreateShopParams {
  ownerKobaId: string;
  name: string;
  bio?: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
}

/** Only name/bio/bannerUrl/avatarUrl are editable — see `Shop`'s docstring. */
export interface UpdateShopProfileParams {
  name?: string;
  bio?: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
}

/**
 * Discriminated union: a shop's influencer payout rate is either a
 * percentage of the sale or a fixed cents amount, never both, never
 * neither — see `ShopPromoService#setPromoSettings()` for the validation
 * that enforces this at write time (ROADMAP.md Phase 4's promo-settings
 * deliverable; actual referral code generation/payout execution is
 * Phase 10, out of scope here).
 */
export type PromoPayoutConfig =
  | { readonly kind: 'percent'; readonly percent: number }
  | { readonly kind: 'fixed'; readonly fixedCents: number };

/**
 * Input to `ShopPromoService#setPromoSettings()`. Exactly one of
 * `percent`/`fixedCents` must be provided — both set or neither set is a
 * typed validation error (`InvalidPromoPayoutConfigError`).
 */
export interface SetPromoSettingsParams {
  promoEligible: boolean;
  percent?: number;
  fixedCents?: number;
}

export interface ShopAnalytics {
  readonly shopId: string;
  /** Sum of settled Order amounts (integer cents — never a float) where
   * the order's sellerKobaId belongs to this shop. */
  readonly totalRevenueCents: number;
  readonly orderCount: number;
  readonly followerCount: number;
  /** Count of this shop's Products per rarity tier — matches the Phase 0
   * design's "Rarity distribution" bar on the Shop Page screen. */
  readonly rarityDistribution: Record<string, number>;
}
