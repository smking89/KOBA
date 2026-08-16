import {
  DEFAULT_PROMO_BPS,
  MAX_FIXED_CENTS,
  MAX_PROMO_BPS,
  type PromoPayoutType,
} from "@/features/influencer/lib/types";

export type PaymentSplit = {
  totalCents: number;
  applicationFeeCents: number;
  sellerPayoutCents: number;
};

export function parseMaxPromoBps(raw?: string): number {
  if (!raw) return MAX_PROMO_BPS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PROMO_BPS) {
    return MAX_PROMO_BPS;
  }
  return parsed;
}

export function influencerShareCents(input: {
  totalCents: number;
  sellerPayoutCents: number;
  payoutType: PromoPayoutType;
  payoutValue: number;
  maxBps?: number;
}): number {
  if (input.totalCents <= 0 || input.sellerPayoutCents <= 0) {
    return 0;
  }
  let raw = 0;
  if (input.payoutType === "PERCENT_BPS") {
    const maxBps = input.maxBps ?? parseMaxPromoBps(process.env.KOBA_INFLUENCER_MAX_BPS);
    const bps = Math.min(Math.max(0, input.payoutValue), maxBps);
    raw = Math.floor((input.totalCents * bps) / 10_000);
  } else {
    raw = Math.min(Math.max(0, input.payoutValue), MAX_FIXED_CENTS);
  }
  return Math.min(raw, input.sellerPayoutCents);
}

export function applyInfluencerShare(
  split: PaymentSplit,
  shareCents: number,
): PaymentSplit & { influencerShareCents: number } {
  const share = Math.min(Math.max(0, shareCents), split.sellerPayoutCents);
  return {
    totalCents: split.totalCents,
    applicationFeeCents: split.applicationFeeCents + share,
    sellerPayoutCents: split.sellerPayoutCents - share,
    influencerShareCents: share,
  };
}

export function isValidPromoConfig(input: {
  payoutType: PromoPayoutType;
  payoutValue: number;
}): boolean {
  if (input.payoutType === "PERCENT_BPS") {
    return (
      Number.isInteger(input.payoutValue) &&
      input.payoutValue >= 0 &&
      input.payoutValue <= MAX_PROMO_BPS
    );
  }
  return (
    Number.isInteger(input.payoutValue) &&
    input.payoutValue >= 0 &&
    input.payoutValue <= MAX_FIXED_CENTS
  );
}

export function defaultPromoConfig() {
  return {
    influencerEligible: false,
    payoutType: "PERCENT_BPS" as const,
    payoutValue: DEFAULT_PROMO_BPS,
  };
}

export function canUseReferral(input: {
  buyerUserId: string;
  influencerUserId: string;
  shopOwnerUserId: string;
  shopMemberUserIds: readonly string[];
}): boolean {
  return (
    input.buyerUserId !== input.influencerUserId &&
    input.influencerUserId !== input.shopOwnerUserId &&
    !input.shopMemberUserIds.includes(input.influencerUserId)
  );
}

export function earningStatusAfterRefund(status: string): "VOID" | "HELD" | null {
  if (status === "ACCRUED" || status === "PAYABLE") {
    return "VOID";
  }
  if (status === "PAID") {
    return "HELD";
  }
  return null;
}
