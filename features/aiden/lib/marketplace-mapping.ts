import type { AidenAssetType, ProductCategoryKind } from "@/lib/generated/prisma/client";

/**
 * Maps a generated asset's type to the marketplace category kind a
 * seller must publish it under (features/aiden/services/aiden.service.ts's
 * publishAssetToMarketplace validates the seller-chosen category's `kind`
 * against this, the same defense-in-depth shape as
 * assertGameAllowsListing in product-admin.service.ts).
 *
 * CONCEPT_IMAGE maps to null deliberately — it's a mockup/preview, never
 * a deliverable asset, so it's not publishable at all regardless of
 * technicalStatus.
 *
 * Every Aiden asset type maps to a Product category, never Cosmetic —
 * Cosmetic (nameplates/avatar decorations/profile effects/frames/shop
 * banners/emoji) is KOBA's own platform-identity model, not something any
 * AidenAssetType conceptually produces (see ROADMAP.md Phase 3's
 * Cosmetic-vs-Product correction). If a future asset type is added that
 * genuinely is a Cosmetic (e.g. a generated nameplate design), this
 * function is the place to special-case it, not somewhere new.
 */
export function expectedCategoryKindForAssetType(
  assetType: AidenAssetType,
): ProductCategoryKind | null {
  switch (assetType) {
    case "SKIN":
      return "SKINS";
    case "MAP":
    case "TERRAIN":
      return "MAPS";
    case "PROP":
      return "MONUMENTS";
    case "TEXTURE":
    case "ANIMATION":
      return "SERVER_ASSETS";
    case "CONCEPT_IMAGE":
      return null;
    default:
      return null;
  }
}
