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

/**
 * Pure status-transition legality check for releaseEscrow(): a row can be
 * released from HOLDING (the normal auto-release-sweep path) or DISPUTED
 * (staff resolved a dispute with RELEASE). Already-RELEASED/REFUNDED rows
 * are not "releasable" — releaseEscrow() treats those as an idempotent
 * no-op rather than an error, which is a separate concern from this check.
 *
 * Note: the auto-release sweep additionally filters its own query to
 * `status: "HOLDING"` only (see escrow.service.ts#sweepExpiredEscrowHolds),
 * so in practice a DISPUTED row is never released except via the
 * staff-gated resolveDispute() path — this function only encodes which
 * transitions are *legal*, not which caller is *authorized* to trigger one.
 */
export function canReleaseEscrow(input: { escrowStatus: string }): boolean {
  return input.escrowStatus === "HOLDING" || input.escrowStatus === "DISPUTED";
}
