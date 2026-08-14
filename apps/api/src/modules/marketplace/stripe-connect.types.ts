/**
 * Structural model of Stripe Connect account state only — no real Stripe
 * SDK/API calls anywhere in this module. Matches the three states shown
 * in the Phase 0 design's Stripe Connection screen.
 */
export enum StripeAccountStatus {
  NOT_CONNECTED = 'notConnected',
  PENDING = 'pending',
  ACTIVE = 'active',
}

/** Result of platform-fee math for a settled order amount. */
export interface PlatformFeeBreakdown {
  readonly platformFeeCents: number;
  readonly sellerPayoutCents: number;
}

/**
 * Two-tier platform fee rate schedule (each rate is 0..1), per
 * `roadmap/platform-fee-research.md` §2's revised recommendation:
 * 8% standard, 4% for Blue-Badge-verified shops. Still injected as DI
 * configuration rather than hardcoded inside `calculateFee()` itself, so
 * a future pricing review only touches module wiring.
 */
export interface PlatformFeeRateSchedule {
  readonly standardRate: number;
  readonly verifiedRate: number;
}

/** DI token for the injected {@link PlatformFeeRateSchedule}. */
export const PLATFORM_FEE_RATE_SCHEDULE = Symbol('PLATFORM_FEE_RATE_SCHEDULE');
