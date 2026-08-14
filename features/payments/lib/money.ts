export const DEFAULT_COMMISSION_BPS = 1000;
export const MAX_COMMISSION_BPS = 2500;

export function parseCommissionBps(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_COMMISSION_BPS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_COMMISSION_BPS) {
    return DEFAULT_COMMISSION_BPS;
  }
  return parsed;
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
