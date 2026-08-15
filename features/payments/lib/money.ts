export const DEFAULT_COMMISSION_BPS = 800;
export const DEFAULT_VERIFIED_COMMISSION_BPS = 400;
export const MAX_COMMISSION_BPS = 2500;

/**
 * Stripe's absolute per-charge ceiling: $999,999.99 in the smallest currency
 * unit. A single listing is already capped well under this (see
 * priceCents/amountCents max on the product, cosmetic, and bid schemas —
 * $100,000), but fixed-price checkout allows quantity up to 10, so
 * priceCents(max) * quantity(max) can reach $1,000,000.00 and exceed it.
 * Guard the computed total explicitly rather than letting Stripe reject the
 * charge with an opaque error at checkout time.
 */
export const STRIPE_MAX_CHARGE_CENTS = 99_999_999;

export function exceedsStripeChargeLimit(totalCents: number): boolean {
  return totalCents > STRIPE_MAX_CHARGE_CENTS;
}

export function parseCommissionBps(
  raw: string | undefined,
  fallback: number = DEFAULT_COMMISSION_BPS,
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_COMMISSION_BPS) {
    return fallback;
  }
  return parsed;
}

/** Unverified / pending / rejected shops: standard take rate (default 8%). */
export function unverifiedCommissionBps(): number {
  return parseCommissionBps(process.env.KOBA_COMMISSION_BPS, DEFAULT_COMMISSION_BPS);
}

/** Blue-Badge verified shops: reduced take rate (default 4%). */
export function verifiedCommissionBps(): number {
  return parseCommissionBps(
    process.env.KOBA_COMMISSION_BPS_VERIFIED,
    DEFAULT_VERIFIED_COMMISSION_BPS,
  );
}

/**
 * Platform fee in basis points from shop verification status.
 * Only VERIFIED shops get the reduced Blue-Badge rate.
 */
export function resolveCommissionBps(verificationStatus: string | null | undefined): number {
  if (verificationStatus === "VERIFIED") {
    return verifiedCommissionBps();
  }
  return unverifiedCommissionBps();
}

export function splitPayment(totalCents: number, commissionBps: number) {
  if (totalCents < 0) {
    throw new RangeError("Total cannot be negative.");
  }
  const applicationFeeCents =
    totalCents === 0 || commissionBps === 0
      ? 0
      : Math.max(1, Math.floor((totalCents * commissionBps) / 10_000));
  const cappedFee = Math.min(applicationFeeCents, totalCents);
  return {
    totalCents,
    applicationFeeCents: cappedFee,
    sellerPayoutCents: totalCents - cappedFee,
  };
}

export function canCheckoutListing(input: {
  buyerUserId: string;
  sellerUserId: string;
  shopMemberUserIds: readonly string[];
}): boolean {
  return (
    input.buyerUserId !== input.sellerUserId && !input.shopMemberUserIds.includes(input.buyerUserId)
  );
}

export function canPayReservedAuction(input: {
  buyerUserId: string;
  winnerUserId: string | null;
  status: string;
  reservedUntil: Date | null;
  now: Date;
}): boolean {
  return (
    input.status === "RESERVED" &&
    input.winnerUserId === input.buyerUserId &&
    input.reservedUntil != null &&
    input.now < input.reservedUntil
  );
}

/** Browser-supplied paid flags are ignored. Status comes from Stripe webhooks only. */
export function paidStatusFromClient(clientPaid: unknown): "PENDING" {
  void clientPaid;
  return "PENDING";
}
