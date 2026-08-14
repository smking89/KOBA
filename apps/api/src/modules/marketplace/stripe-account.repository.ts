import { StripeAccountStatus } from './stripe-connect.types';

/**
 * Storage seam for per-seller-KOBAID Stripe Connect account status.
 * Structural only this phase — see stripe-connect.service.ts and
 * marketplace/README.md for what's explicitly out of scope (real charge
 * creation, webhooks, Connect onboarding).
 */
export const STRIPE_ACCOUNT_REPOSITORY = Symbol('STRIPE_ACCOUNT_REPOSITORY');

export interface StripeAccountRepository {
  /** Defaults to `notConnected` for a KOBAID with no recorded status. */
  getStatus(sellerKobaId: string): Promise<StripeAccountStatus>;
  setStatus(sellerKobaId: string, status: StripeAccountStatus): Promise<void>;
}
