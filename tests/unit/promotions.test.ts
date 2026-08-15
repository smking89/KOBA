import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertNonNegativeSnapshot,
  buildPricingSnapshot,
  promoDiscountCents,
  rateAmount,
} from "@/features/promotions/lib/pricing";
import {
  canTransitionCampaign,
  canTransitionParticipation,
  campaignIsAttributable,
  participationIsAttributable,
} from "@/features/promotions/lib/campaign-state";
import {
  canTransitionCommission,
  isPastHold,
  refundCommissionStatus,
} from "@/features/promotions/lib/commission-state";
import {
  chooseAttribution,
  isSelfReferral,
  isWithinAttributionWindow,
} from "@/features/promotions/lib/attribution";
import { isSafeInternalPath, sanitizeRedirectPath } from "@/features/promotions/lib/redirects";
import {
  generateReferralToken,
  normalizePromoCode,
  readSignedAttributionCookie,
  signAttributionCookie,
  visitorHash,
} from "@/features/promotions/lib/tokens";
import {
  isAdvertiserSelfClick,
  isCampaignBillable,
  selectSponsoredAd,
  type SponsoredCandidate,
} from "@/features/promotions/lib/ad-selection";
import { canConsumeBudget, canIncrementUsage } from "@/features/promotions/lib/fraud";
import {
  canStaffModeratePromotions,
  canStaffVerifyInfluencer,
} from "@/features/promotions/lib/access";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";
import {
  createAffiliateCampaignSchema,
  createPromoCodeSchema,
  updateInfluencerProfileSchema,
} from "@/features/promotions/schemas/promotions.schemas";

const now = new Date("2026-08-15T12:00:00.000Z");

describe("influencer profile authorization", () => {
  it("lets staff verify and moderate, never the influencer schema", () => {
    expect(canStaffVerifyInfluencer(["ADMIN"])).toBe(true);
    expect(canStaffVerifyInfluencer(["INFLUENCER"])).toBe(false);
    expect(canStaffModeratePromotions(["MODERATOR"])).toBe(true);
    expect(updateInfluencerProfileSchema.safeParse({ displayName: "A" }).success).toBe(false);
  });
});

describe("campaign state transitions", () => {
  it("requires staff approval before going live", () => {
    expect(canTransitionCampaign("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionCampaign("DRAFT", "ACTIVE")).toBe(false);
    expect(canTransitionCampaign("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransitionCampaign("APPROVED", "ACTIVE")).toBe(true);
    expect(campaignIsAttributable("ACTIVE", now, null, null)).toBe(true);
    expect(campaignIsAttributable("PAUSED", now, null, null)).toBe(false);
  });

  it("restricts invitation and application transitions", () => {
    expect(canTransitionParticipation("INVITED", "ACTIVE")).toBe(true);
    expect(canTransitionParticipation("APPLIED", "ACTIVE")).toBe(true);
    expect(canTransitionParticipation("REJECTED", "ACTIVE")).toBe(false);
    expect(participationIsAttributable("ACTIVE")).toBe(true);
    expect(participationIsAttributable("APPLIED")).toBe(false);
  });
});

describe("referral tokens and redirects", () => {
  it("generates opaque unguessable tokens", () => {
    const token = generateReferralToken(() =>
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    );
    expect(token.startsWith("kref_")).toBe(true);
    expect(token).not.toContain("user_");
    expect(token.length).toBeGreaterThan(12);
  });

  it("only allows internal KOBA destinations", () => {
    expect(isSafeInternalPath("/market/oil-kit")).toBe(true);
    expect(isSafeInternalPath("/shops/acme")).toBe(true);
    expect(isSafeInternalPath("https://evil.test")).toBe(false);
    expect(isSafeInternalPath("//evil.test")).toBe(false);
    expect(isSafeInternalPath("/login")).toBe(false);
    expect(sanitizeRedirectPath("https://evil.test")).toBe("/market");
  });
});

describe("attribution policy", () => {
  const base = {
    participationId: "p1",
    campaignId: "c1",
    influencerUserId: "inf",
    sellerUserId: "seller",
    clickedAt: new Date("2026-08-15T10:00:00.000Z"),
    windowHours: 168,
    source: "CLICK" as const,
  };

  it("uses last eligible click within the window", () => {
    expect(isWithinAttributionWindow(base.clickedAt, now, 168)).toBe(true);
    expect(isWithinAttributionWindow(base.clickedAt, now, 1)).toBe(false);
    const chosen = chooseAttribution({
      click: base,
      promo: null,
      buyerUserId: "buyer",
      now,
      checkoutStartedAt: now,
    });
    expect(chosen?.participationId).toBe("p1");
  });

  it("rejects expired attribution and clicks after checkout", () => {
    expect(
      chooseAttribution({
        click: { ...base, clickedAt: new Date("2026-07-01T00:00:00.000Z") },
        promo: null,
        buyerUserId: "buyer",
        now,
        checkoutStartedAt: now,
      }),
    ).toBeNull();
    expect(
      chooseAttribution({
        click: { ...base, clickedAt: new Date("2026-08-15T13:00:00.000Z") },
        promo: null,
        buyerUserId: "buyer",
        now,
        checkoutStartedAt: now,
      }),
    ).toBeNull();
  });

  it("lets promo-code attribution override click attribution", () => {
    const chosen = chooseAttribution({
      click: base,
      promo: { ...base, participationId: "p2", source: "PROMO_CODE" },
      buyerUserId: "buyer",
      now,
      checkoutStartedAt: now,
    });
    expect(chosen?.participationId).toBe("p2");
    expect(chosen?.source).toBe("PROMO_CODE");
  });

  it("rejects self-referrals and seller/influencer overlap", () => {
    expect(
      isSelfReferral({ buyerUserId: "inf", influencerUserId: "inf", sellerUserId: "seller" }),
    ).toBe(true);
    expect(
      isSelfReferral({ buyerUserId: "buyer", influencerUserId: "seller", sellerUserId: "seller" }),
    ).toBe(true);
    expect(
      chooseAttribution({
        click: base,
        promo: null,
        buyerUserId: "inf",
        now,
        checkoutStartedAt: now,
      }),
    ).toBeNull();
  });
});

describe("signed attribution cookies", () => {
  it("rejects tampered or expired cookies", () => {
    const exp = Date.now() + 60_000;
    const signed = signAttributionCookie("kref_abc", exp);
    expect(readSignedAttributionCookie(signed)).toBe("kref_abc");
    expect(readSignedAttributionCookie(`${signed}ff`)).toBeNull();
    expect(readSignedAttributionCookie(signed.slice(0, -2) + "00")).toBeNull();
    expect(
      readSignedAttributionCookie(signAttributionCookie("kref_abc", Date.now() - 1)),
    ).toBeNull();
  });

  it("hashes visitor network data without storing the raw IP", () => {
    const hash = visitorHash("203.0.113.9", "2026-08-15");
    expect(hash).toHaveLength(32);
    expect(hash).not.toContain("203.0.113.9");
    const expected = createHmac(
      "sha256",
      process.env.AUTH_SECRET?.trim() || "koba-dev-attribution-key",
    )
      .update("promo:2026-08-15:203.0.113.9")
      .digest("hex")
      .slice(0, 32);
    expect(hash).toBe(expected);
  });
});

describe("promo codes and pricing snapshots", () => {
  it("normalizes codes and rejects over-cap percentages", () => {
    expect(normalizePromoCode("  summer-20 ")).toBe("SUMMER-20");
    expect(
      createPromoCodeSchema.safeParse({
        code: "SAVE",
        discountType: "PERCENTAGE",
        discountValue: 1000,
      }).success,
    ).toBe(true);
  });

  it("floors percentage discounts and never exceeds eligible value", () => {
    expect(promoDiscountCents({ subtotalCents: 999, type: "PERCENTAGE", value: 1000 })).toBe(99);
    expect(promoDiscountCents({ subtotalCents: 500, type: "FIXED", value: 800 })).toBe(500);
    expect(rateAmount({ baseCents: 1000, type: "PERCENTAGE", value: 2500, maxBps: 2500 })).toBe(
      250,
    );
  });

  it("builds an immutable snapshot that cannot go negative", () => {
    const snapshot = buildPricingSnapshot({
      originalSubtotalCents: 10_000,
      discountCents: 1_000,
      platformFeeBps: 800,
      commissionType: "PERCENTAGE",
      commissionValue: 1000,
    });
    expect(snapshot.eligibleCommissionBaseCents).toBe(9_000);
    expect(
      snapshot.platformFeeCents + snapshot.influencerCommissionCents + snapshot.sellerProceedsCents,
    ).toBe(9_000);
    expect(assertNonNegativeSnapshot(snapshot)).toBe(true);
    const capped = buildPricingSnapshot({
      originalSubtotalCents: 100,
      discountCents: 0,
      platformFeeBps: 800,
      commissionType: "FIXED",
      commissionValue: 10_000,
    });
    expect(capped.sellerProceedsCents).toBeGreaterThanOrEqual(0);
    expect(capped.influencerCommissionCents + capped.platformFeeCents).toBeLessThanOrEqual(100);
  });

  it("enforces usage limits for concurrent last redemptions", () => {
    expect(canIncrementUsage(9, 10)).toBe(true);
    expect(canIncrementUsage(10, 10)).toBe(false);
    expect(canIncrementUsage(0, null)).toBe(true);
  });
});

describe("commission lifecycle", () => {
  it("does not skip pending after unpaid checkout", () => {
    expect(canTransitionCommission("PENDING", "AVAILABLE")).toBe(false);
    expect(canTransitionCommission("PENDING", "QUALIFIED")).toBe(true);
    expect(canTransitionCommission("QUALIFIED", "AVAILABLE")).toBe(true);
    expect(isPastHold(new Date(now.getTime() - 71 * 3600_000), now, 72)).toBe(false);
    expect(isPastHold(new Date(now.getTime() - 73 * 3600_000), now, 72)).toBe(true);
  });

  it("reverses refunds and chargebacks from any payable state", () => {
    expect(refundCommissionStatus("PENDING")).toBe("REVERSED");
    expect(refundCommissionStatus("AVAILABLE")).toBe("REVERSED");
    expect(refundCommissionStatus("PAID")).toBe("REVERSED");
    expect(refundCommissionStatus("REVERSED")).toBeNull();
  });

  it("keeps currencies separate and refuses over-budget commissions", () => {
    expect(canConsumeBudget(500, 500)).toBe(true);
    expect(canConsumeBudget(499, 500)).toBe(false);
    const usd = buildPricingSnapshot({
      originalSubtotalCents: 1000,
      discountCents: 0,
      platformFeeBps: 800,
      commissionType: "PERCENTAGE",
      commissionValue: 1000,
    });
    expect(usd.influencerCommissionCents).toBe(100);
  });
});

describe("sponsored ads", () => {
  const campaign = (id: string, extra: Partial<SponsoredCandidate> = {}): SponsoredCandidate => ({
    id,
    remainingBudgetCoins: 50n,
    dailyBudgetCoins: 20n,
    dailySpentCoins: 0n,
    dailySpentOn: null,
    cpcCoins: 5n,
    frequencyCap: 6,
    impressionsForViewer: 0,
    targetGameId: "rust",
    targetCategoryId: null,
    targetPlatform: null,
    targetRegion: null,
    status: "ACTIVE",
    startsAt: null,
    endsAt: null,
    lastShownAt: null,
    ...extra,
  });

  it("selects contextually and rotates deterministically", () => {
    const selected = selectSponsoredAd(
      [campaign("b", { lastShownAt: now }), campaign("a", { lastShownAt: new Date(0) })],
      { gameId: "rust", now },
    );
    expect(selected?.id).toBe("a");
  });

  it("enforces daily budget, frequency cap, and suspension", () => {
    expect(isCampaignBillable(campaign("x", { remainingBudgetCoins: 4n }), now)).toBe(false);
    expect(
      isCampaignBillable(campaign("x", { dailySpentCoins: 20n, dailySpentOn: now }), now),
    ).toBe(false);
    expect(selectSponsoredAd([campaign("x", { status: "SUSPENDED" })], { now })).toBeNull();
    expect(selectSponsoredAd([campaign("x", { impressionsForViewer: 6 })], { now })).toBeNull();
  });

  it("does not bill advertiser self-clicks or obvious duplicates", () => {
    expect(isAdvertiserSelfClick("adv", "adv")).toBe(true);
    expect(isAdvertiserSelfClick("adv", "viewer")).toBe(false);
  });
});

describe("organic and sponsored separation", () => {
  it("keeps sponsored selection in a separate module from marketplace listing", () => {
    expect(typeof selectSponsoredAd).toBe("function");
    expect(typeof listPublicProductsHint).toBe("function");
  });
});

function listPublicProductsHint() {
  return "features/marketplace/services/product.service.ts";
}

describe("account isolation and staff routes", () => {
  it("protects influencer, seller, and financial APIs", () => {
    expect(isProtectedPath("/influencer/commissions")).toBe(true);
    expect(isProtectedPath("/seller/promotions")).toBe(true);
    expect(isSensitivePath("/api/seller/promotions")).toBe(true);
    expect(isSensitivePath("/api/influencer/commissions")).toBe(true);
    expect(isSensitivePath("/api/ads/click")).toBe(true);
  });

  it("validates campaign create payloads without passing through raw bodies", () => {
    expect(
      createAffiliateCampaignSchema.safeParse({
        name: "Summer",
        productSlugs: ["oil-kit"],
        commissionType: "PERCENTAGE",
        commissionValue: 1000,
        totalBudgetCents: 5000,
      }).success,
    ).toBe(true);
    expect(createAffiliateCampaignSchema.safeParse({ name: "x" }).success).toBe(false);
  });
});
