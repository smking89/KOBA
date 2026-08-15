export const PROMOTION_RATE_TYPES = ["FIXED", "PERCENTAGE"] as const;
export type PromotionRateType = (typeof PROMOTION_RATE_TYPES)[number];

export const MAX_COMMISSION_BPS = 2500;
export const MAX_DISCOUNT_BPS = 5000;

export function parseLimitBps(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return fallback;
  return parsed;
}

export function maxCommissionBps(): number {
  return parseLimitBps(process.env.KOBA_MAX_COMMISSION_BPS, MAX_COMMISSION_BPS, MAX_COMMISSION_BPS);
}

export function maxDiscountBps(): number {
  return parseLimitBps(process.env.KOBA_MAX_DISCOUNT_BPS, MAX_DISCOUNT_BPS, MAX_DISCOUNT_BPS);
}

export function rateAmount(input: {
  baseCents: number;
  type: PromotionRateType;
  value: number;
  maxBps: number;
  maxFixed?: number;
}): number {
  if (input.baseCents <= 0) return 0;
  if (input.type === "PERCENTAGE") {
    const bps = Math.min(Math.max(0, input.value), input.maxBps);
    return Math.floor((input.baseCents * bps) / 10_000);
  }
  const cap = input.maxFixed ?? input.baseCents;
  return Math.min(Math.max(0, input.value), cap, input.baseCents);
}

export type PricingSnapshot = {
  originalSubtotalCents: number;
  discountCents: number;
  eligibleCommissionBaseCents: number;
  platformFeeCents: number;
  influencerCommissionCents: number;
  sellerProceedsCents: number;
};

export function buildPricingSnapshot(input: {
  originalSubtotalCents: number;
  discountCents: number;
  platformFeeBps: number;
  commissionType: PromotionRateType | null;
  commissionValue: number | null;
}): PricingSnapshot {
  const original = Math.max(0, input.originalSubtotalCents);
  const discount = Math.min(Math.max(0, input.discountCents), original);
  const eligible = original - discount;
  const platformFee =
    eligible === 0
      ? 0
      : Math.min(eligible, Math.max(1, Math.floor((eligible * input.platformFeeBps) / 10_000)));
  const remainderAfterFee = eligible - platformFee;
  const commission =
    input.commissionType && input.commissionValue != null
      ? rateAmount({
          baseCents: eligible,
          type: input.commissionType,
          value: input.commissionValue,
          maxBps: maxCommissionBps(),
        })
      : 0;
  const influencerCommissionCents = Math.min(commission, remainderAfterFee);
  return {
    originalSubtotalCents: original,
    discountCents: discount,
    eligibleCommissionBaseCents: eligible,
    platformFeeCents: platformFee,
    influencerCommissionCents,
    sellerProceedsCents: remainderAfterFee - influencerCommissionCents,
  };
}

export function assertNonNegativeSnapshot(snapshot: PricingSnapshot): boolean {
  return (
    snapshot.originalSubtotalCents >= 0 &&
    snapshot.discountCents >= 0 &&
    snapshot.eligibleCommissionBaseCents >= 0 &&
    snapshot.platformFeeCents >= 0 &&
    snapshot.influencerCommissionCents >= 0 &&
    snapshot.sellerProceedsCents >= 0 &&
    snapshot.discountCents + snapshot.eligibleCommissionBaseCents ===
      snapshot.originalSubtotalCents &&
    snapshot.platformFeeCents +
      snapshot.influencerCommissionCents +
      snapshot.sellerProceedsCents ===
      snapshot.eligibleCommissionBaseCents
  );
}

export function promoDiscountCents(input: {
  subtotalCents: number;
  type: PromotionRateType;
  value: number;
  maxDiscountCents?: number | null;
}): number {
  const raw = rateAmount({
    baseCents: input.subtotalCents,
    type: input.type,
    value: input.value,
    maxBps: maxDiscountBps(),
  });
  if (input.maxDiscountCents == null) return raw;
  return Math.min(raw, Math.max(0, input.maxDiscountCents));
}
