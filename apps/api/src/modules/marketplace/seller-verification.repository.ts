/**
 * Storage seam for whether a seller currently holds Blue Badge
 * verification. Phase 9 (Developer Portal) owns the real `BlueBadgeGrant`
 * model and hasn't landed yet — this interface is the minimum shape this
 * module needs so `StripeConnectService` can look up verification status
 * *at settlement time* (per `roadmap/platform-fee-research.md` §6) without
 * this module depending on Phase 9's real model. Phase 9 can later add a
 * Prisma-backed implementation of this same interface with no change to
 * this module's shape.
 */
export const SELLER_VERIFICATION_REPOSITORY = Symbol('SELLER_VERIFICATION_REPOSITORY');

export interface SellerVerificationRepository {
  /** Defaults to `false` (unverified) for a KOBAID with no recorded grant. */
  isVerifiedSeller(sellerKobaId: string): Promise<boolean>;
}
