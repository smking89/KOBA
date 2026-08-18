import { describe, expect, it } from "vitest";
import { createSponsoredCampaignSchema } from "@/features/promotions/schemas/promotions.schemas";
import { isCampaignBillable, selectSponsoredAd, type SponsoredCandidate } from "@/features/promotions/lib/ad-selection";

// KOBA Ads / Phase 7 (client, 2026-08-18): "native rendering must be
// visually/structurally identical to organic content across every ad
// type: product, shop, group, creator, LFG, and cosmetic ads." Extends
// the pre-existing SponsoredCampaign system (features/promotions)
// rather than a second, parallel ad system, confirmed via
// AskUserQuestion.

const BASE_INPUT = {
  entityId: "prod_123",
  totalBudgetCoins: 1000,
  dailyBudgetCoins: 100,
};

describe("createSponsoredCampaignSchema — Phase 7 entity/placement expansion", () => {
  it("accepts every entity type in the client's spec list", () => {
    for (const entityType of ["PRODUCT", "SHOP", "GROUP", "INFLUENCER", "LFG", "COSMETIC"] as const) {
      const result = createSponsoredCampaignSchema.safeParse({
        ...BASE_INPUT,
        entityType,
        placement: "FEED",
      });
      expect(result.success).toBe(true);
    }
  });

  it("still accepts the two bonus types this system already had beyond the spec", () => {
    for (const entityType of ["DEV_PRODUCT", "GAME_SERVER"] as const) {
      const result = createSponsoredCampaignSchema.safeParse({
        ...BASE_INPUT,
        entityType,
        placement: "MARKETPLACE",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts the new FEED placement alongside the four existing browse-page ones", () => {
    for (const placement of ["MARKETPLACE", "SHOP", "APPS", "SERVERS", "FEED"] as const) {
      const result = createSponsoredCampaignSchema.safeParse({
        ...BASE_INPUT,
        entityType: "PRODUCT",
        placement,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown entity type", () => {
    const result = createSponsoredCampaignSchema.safeParse({
      ...BASE_INPUT,
      entityType: "POST",
      placement: "FEED",
    });
    expect(result.success).toBe(false);
  });
});

function candidate(overrides: Partial<SponsoredCandidate> = {}): SponsoredCandidate {
  return {
    id: "camp_1",
    remainingBudgetCoins: 500n,
    dailyBudgetCoins: 100n,
    dailySpentCoins: 0n,
    dailySpentOn: null,
    cpcCoins: 10n,
    frequencyCap: 6,
    impressionsForViewer: 0,
    targetGameId: null,
    targetCategoryId: null,
    targetPlatform: null,
    targetRegion: null,
    status: "ACTIVE",
    startsAt: null,
    endsAt: null,
    lastShownAt: null,
    ...overrides,
  };
}

describe("ad-selection — FEED placement calls with an empty context", () => {
  // features/social/services/post.service.ts#fetchFeedAdEntry calls
  // pickSponsoredPlacement({ placement: "FEED", context: {} }) — no
  // game/category/platform/region targeting exists for a social feed
  // slot, unlike the browse-page placements. Confirms an untargeted
  // campaign still gets selected against that empty context.
  it("selects an untargeted campaign against an empty context", () => {
    const now = new Date();
    const result = selectSponsoredAd([candidate()], { now });
    expect(result?.id).toBe("camp_1");
  });

  it("still respects budget exhaustion and frequency capping for FEED the same as any placement", () => {
    const now = new Date();
    expect(isCampaignBillable(candidate({ remainingBudgetCoins: 5n }), now)).toBe(false);
    expect(
      selectSponsoredAd([candidate({ impressionsForViewer: 6, frequencyCap: 6 })], { now }),
    ).toBeNull();
  });
});
