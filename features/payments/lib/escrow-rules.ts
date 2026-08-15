export const DEFAULT_ESCROW_HOLD_DAYS = 3;
export const MAX_ESCROW_HOLD_DAYS = 30;

export function parseEscrowHoldDays(
  raw: string | undefined,
  fallback: number = DEFAULT_ESCROW_HOLD_DAYS,
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_ESCROW_HOLD_DAYS) {
    return fallback;
  }
  return parsed;
}

/** Days the platform holds a seller's payout before auto-release (default 3, cap 30). */
export function escrowHoldDays(): number {
  return parseEscrowHoldDays(process.env.KOBA_ESCROW_HOLD_DAYS, DEFAULT_ESCROW_HOLD_DAYS);
}

export function computeEscrowReleaseAt(paidAt: Date, holdDays: number): Date {
  const releaseAt = new Date(paidAt.getTime());
  releaseAt.setUTCDate(releaseAt.getUTCDate() + holdDays);
  return releaseAt;
}

/**
 * Pure eligibility check for a buyer flagging a dispute: only the order's
 * buyer, only while escrow is still HOLDING, and only before the release
 * window has passed.
 */
export function canFlagDispute(input: {
  buyerUserId: string;
  orderBuyerUserId: string;
  escrowStatus: string;
  releaseAt: Date;
  now: Date;
}): boolean {
  return (
    input.buyerUserId === input.orderBuyerUserId &&
    input.escrowStatus === "HOLDING" &&
    input.now < input.releaseAt
  );
}

/** Pure legality check for staff resolving a dispute. */
export function canResolveDispute(input: { escrowStatus: string }): boolean {
  return input.escrowStatus === "DISPUTED";
}

/** Pure idempotency check: only HOLDING escrow rows are eligible for release. */
export function canReleaseEscrow(input: { escrowStatus: string }): boolean {
  return input.escrowStatus === "HOLDING";
}
