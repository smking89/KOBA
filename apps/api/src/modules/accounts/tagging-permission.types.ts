/**
 * Typed tagging-permission set. This is the mode-to-permission *rule*
 * mapping ROADMAP.md's Phase 2 section calls for — Phase 6 (Social Layer)
 * is what actually builds `TagAction`/@mention parsing/rendering and
 * enforces these rules; this module only needs the rules to exist and be
 * queryable, same pure-function style as `CapabilityFlags`.
 */
export interface TaggingPermissions {
  /** Tag other players/shops/products in normal social contexts. */
  canTagAsPlayer: boolean;
  /**
   * Tag its own products/shop in promotional contexts (Business mode
   * only — ROADMAP Phase 6: "Business mode enables shop/product tagging").
   */
  canTagShopProducts: boolean;
  /**
   * Attach promo/referral tagging (Influencer mode only — ROADMAP Phase 6:
   * "Influencer mode enables promo tagging").
   */
  canTagPromo: boolean;
}

export const NO_TAGGING_PERMISSIONS: TaggingPermissions = {
  canTagAsPlayer: false,
  canTagShopProducts: false,
  canTagPromo: false,
};
