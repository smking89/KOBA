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
 * DI token for the configurable platform fee rate (0..1). ROADMAP.md
 * flags the actual rate as an open client question (see "Open questions
 * for the client" #8) — nothing in this module hardcodes a specific rate
 * as a magic constant; callers/module wiring supply it.
 */
export const PLATFORM_FEE_RATE = Symbol('PLATFORM_FEE_RATE');
