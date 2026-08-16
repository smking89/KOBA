import { describe, expect, it } from "vitest";
import { splitPayment } from "@/features/payments/lib/money";
import { canTagShop, influencerMayTagShop } from "@/features/social/lib/rules";
import {
  applyInfluencerShare,
  canUseReferral,
  earningStatusAfterRefund,
  influencerShareCents,
  isValidPromoConfig,
} from "@/features/influencer/lib/payouts";
import {
  buildReferralCode,
  normalizeReferralCode,
  referralSharePath,
} from "@/features/influencer/lib/refs";
import {
  createReferralCodeSchema,
  updateShopPromoSchema,
} from "@/features/influencer/schemas/influencer.schemas";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

describe("referral code format", () => {
  it("embeds the handle and product slug", () => {
    expect(buildReferralCode("max-builds", "oil-rig-kit")).toBe("MAXBUILDS-OIL-RIG-KIT");
    expect(buildReferralCode("ab", "x")).toBe("AB-X");
    expect(buildReferralCode("!", "slug")).toBe("");
    expect(normalizeReferralCode(" max builds ")).toBe("MAXBUILDS");
    expect(referralSharePath("MAXBUILDS-OIL-RIG-KIT")).toBe("/r/MAXBUILDS-OIL-RIG-KIT");
  });
});

describe("influencer payout math", () => {
  it("takes a percent of the order and never exceeds seller payout", () => {
    const split = splitPayment(10_000, 800);
    const share = influencerShareCents({
      totalCents: split.totalCents,
      sellerPayoutCents: split.sellerPayoutCents,
      payoutType: "PERCENT_BPS",
      payoutValue: 1000,
      maxBps: 2500,
    });
    expect(share).toBe(1000);
    const next = applyInfluencerShare(split, share);
    expect(next.influencerShareCents).toBe(1000);
    expect(next.sellerPayoutCents).toBe(split.sellerPayoutCents - 1000);
    expect(next.applicationFeeCents + next.sellerPayoutCents).toBe(split.totalCents);
  });

  it("caps a 100% promo at the seller remainder so the shop is not negative", () => {
    const split = splitPayment(10_000, 800);
    const share = influencerShareCents({
      totalCents: split.totalCents,
      sellerPayoutCents: split.sellerPayoutCents,
      payoutType: "PERCENT_BPS",
      payoutValue: 10_000,
      maxBps: 2500,
    });
    expect(share).toBe(Math.floor((10_000 * 2500) / 10_000));
    expect(share).toBeLessThanOrEqual(split.sellerPayoutCents);
    const next = applyInfluencerShare(split, split.sellerPayoutCents + 50);
    expect(next.sellerPayoutCents).toBe(0);
    expect(next.applicationFeeCents).toBe(10_000);
  });

  it("supports a fixed-cent cut capped by seller payout", () => {
    const share = influencerShareCents({
      totalCents: 500,
      sellerPayoutCents: 400,
      payoutType: "FIXED_CENTS",
      payoutValue: 9999,
    });
    expect(share).toBe(400);
  });

  it("rejects invalid promo configs", () => {
    expect(isValidPromoConfig({ payoutType: "PERCENT_BPS", payoutValue: 2500 })).toBe(true);
    expect(isValidPromoConfig({ payoutType: "PERCENT_BPS", payoutValue: 2501 })).toBe(false);
    expect(isValidPromoConfig({ payoutType: "FIXED_CENTS", payoutValue: -1 })).toBe(false);
  });
});

describe("referral eligibility", () => {
  it("rejects self-referrals, shop owners, and shop members", () => {
    expect(
      canUseReferral({
        buyerUserId: "buyer",
        influencerUserId: "inf",
        shopOwnerUserId: "shop",
        shopMemberUserIds: [],
      }),
    ).toBe(true);
    expect(
      canUseReferral({
        buyerUserId: "inf",
        influencerUserId: "inf",
        shopOwnerUserId: "shop",
        shopMemberUserIds: [],
      }),
    ).toBe(false);
    expect(
      canUseReferral({
        buyerUserId: "buyer",
        influencerUserId: "shop",
        shopOwnerUserId: "shop",
        shopMemberUserIds: [],
      }),
    ).toBe(false);
    expect(
      canUseReferral({
        buyerUserId: "buyer",
        influencerUserId: "staffer",
        shopOwnerUserId: "shop",
        shopMemberUserIds: ["staffer"],
      }),
    ).toBe(false);
  });

  it("voids unpaid earnings on refund and holds paid ones", () => {
    expect(earningStatusAfterRefund("ACCRUED")).toBe("VOID");
    expect(earningStatusAfterRefund("PAYABLE")).toBe("VOID");
    expect(earningStatusAfterRefund("PAID")).toBe("HELD");
    expect(earningStatusAfterRefund("VOID")).toBeNull();
  });
});

describe("influencer tagging policy", () => {
  it("does not let influencers override a shop tagging opt-out", () => {
    expect(canTagShop(false)).toBe(false);
    expect(influencerMayTagShop(false)).toBe(false);
    expect(influencerMayTagShop(true)).toBe(true);
  });
});

describe("promo schemas and cache policy", () => {
  it("validates create/update payloads", () => {
    expect(createReferralCodeSchema.safeParse({ productSlug: "oil-rig-kit" }).success).toBe(true);
    expect(
      updateShopPromoSchema.safeParse({
        influencerEligible: true,
        payoutType: "PERCENT_BPS",
        payoutValue: 1000,
      }).success,
    ).toBe(true);
    expect(
      updateShopPromoSchema.safeParse({
        influencerEligible: true,
        payoutType: "PERCENT_BPS",
        payoutValue: 9000,
      }).success,
    ).toBe(false);
  });

  it("keeps influencer APIs out of the service worker cache", () => {
    expect(isSensitivePath("/api/influencer/codes")).toBe(true);
    expect(isSensitivePath("/api/influencer/payouts")).toBe(true);
    expect(isSensitivePath("/api/business/promo")).toBe(true);
    expect(isProtectedPath("/influencer")).toBe(true);
  });
});
