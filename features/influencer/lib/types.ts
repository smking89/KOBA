export const PROMO_PAYOUT_TYPES = ["PERCENT_BPS", "FIXED_CENTS"] as const;
export type PromoPayoutType = (typeof PROMO_PAYOUT_TYPES)[number];

export const INFLUENCER_EARNING_STATUSES = ["ACCRUED", "PAYABLE", "PAID", "VOID", "HELD"] as const;
export type InfluencerEarningStatus = (typeof INFLUENCER_EARNING_STATUSES)[number];

export const REFERRAL_COOKIE = "koba_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const DEFAULT_PROMO_BPS = 1000;
export const MAX_PROMO_BPS = 2500;
export const MAX_FIXED_CENTS = 100_000_000;

export type ReferralCodeView = {
  publicRef: string;
  code: string;
  active: boolean;
  clickCount: number;
  productSlug: string;
  productTitle: string;
  shopSlug: string;
  shopName: string;
  createdAt: string;
  sharePath: string;
};

export type InfluencerEarningView = {
  publicRef: string;
  amountCents: number;
  currency: string;
  status: InfluencerEarningStatus;
  orderRef: string;
  code: string;
  createdAt: string;
  paidAt: string | null;
};

export type InfluencerDashboardView = {
  handle: string;
  kobaId: string | null;
  payoutsEnabled: boolean;
  onboarded: boolean;
  clicks: number;
  conversions: number;
  accruedCents: number;
  paidCents: number;
  codes: ReferralCodeView[];
  earnings: InfluencerEarningView[];
};

export type ShopPromoView = {
  influencerEligible: boolean;
  payoutType: PromoPayoutType;
  payoutValue: number;
};

export type PublicPromoListing = {
  handle: string;
  displayName: string | null;
  codes: Array<{
    code: string;
    productSlug: string;
    productTitle: string;
    sharePath: string;
  }>;
};
