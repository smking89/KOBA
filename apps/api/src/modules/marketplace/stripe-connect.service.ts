import { Inject, Injectable } from '@nestjs/common';
import { InvalidMoneyAmountError, StripeAccountNotActiveError } from './marketplace.errors';
import {
  SELLER_VERIFICATION_REPOSITORY,
  SellerVerificationRepository,
} from './seller-verification.repository';
import { STRIPE_ACCOUNT_REPOSITORY, StripeAccountRepository } from './stripe-account.repository';
import {
  PLATFORM_FEE_RATE_SCHEDULE,
  PlatformFeeBreakdown,
  PlatformFeeRateSchedule,
  StripeAccountStatus,
} from './stripe-connect.types';

/**
 * Structural-only Stripe Connect model: account status per seller KOBAID,
 * plus platform-fee math. Does NOT call the real Stripe API, create
 * charges, handle webhooks, or drive Connect onboarding — see
 * marketplace/README.md's TODOs for that real-integration work.
 */
@Injectable()
export class StripeConnectService {
  constructor(
    @Inject(STRIPE_ACCOUNT_REPOSITORY) private readonly repository: StripeAccountRepository,
    @Inject(PLATFORM_FEE_RATE_SCHEDULE) private readonly feeRateSchedule: PlatformFeeRateSchedule,
    @Inject(SELLER_VERIFICATION_REPOSITORY)
    private readonly sellerVerificationRepository: SellerVerificationRepository,
  ) {}

  async getStatus(sellerKobaId: string): Promise<StripeAccountStatus> {
    return this.repository.getStatus(sellerKobaId);
  }

  async setStatus(sellerKobaId: string, status: StripeAccountStatus): Promise<void> {
    await this.repository.setStatus(sellerKobaId, status);
  }

  /**
   * Throws StripeAccountNotActiveError unless the seller's Stripe Connect
   * account status is `active`. Order/settlement completion calls this —
   * see ProductService's buyProduct()/OrderService's settleAuction().
   */
  async assertSellerCanReceivePayouts(sellerKobaId: string): Promise<void> {
    const status = await this.getStatus(sellerKobaId);
    if (status !== StripeAccountStatus.ACTIVE) {
      throw new StripeAccountNotActiveError(sellerKobaId);
    }
  }

  /**
   * Pure platform-fee math for a settled order amount. Two-tier rate
   * schedule injected via PLATFORM_FEE_RATE_SCHEDULE (never a hardcoded
   * magic constant here): `standardRate` (8%) for unverified/regular
   * shops, `verifiedRate` (4%) for Blue-Badge-verified shops — see
   * `roadmap/platform-fee-research.md` §2.
   *
   * `isVerifiedSeller` must reflect the seller's Blue Badge status *as of
   * settlement time*, not a value cached at checkout — Blue Badge can be
   * revoked mid-cycle. Callers that need to resolve that status at the
   * moment of settlement should use `calculateFeeForSeller()` instead of
   * passing a value they resolved/cached earlier.
   */
  calculateFee(amountCents: number, isVerifiedSeller: boolean): PlatformFeeBreakdown {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new InvalidMoneyAmountError('amountCents', amountCents);
    }
    const rate = isVerifiedSeller ? this.feeRateSchedule.verifiedRate : this.feeRateSchedule.standardRate;
    const platformFeeCents = Math.round(amountCents * rate);
    const sellerPayoutCents = amountCents - platformFeeCents;
    return { platformFeeCents, sellerPayoutCents };
  }

  /**
   * Same math as `calculateFee()`, but resolves the seller's verification
   * status via SELLER_VERIFICATION_REPOSITORY at call time instead of
   * taking it as a parameter — the seam settlement code should call so the
   * badge check always happens *as of settlement time*
   * (`roadmap/platform-fee-research.md` §6), never a value cached from an
   * earlier checkout step. Backed by an in-memory stand-in until Phase 9
   * (Developer Portal / Blue Badge) lands a real implementation of
   * SellerVerificationRepository.
   */
  async calculateFeeForSeller(sellerKobaId: string, amountCents: number): Promise<PlatformFeeBreakdown> {
    const isVerifiedSeller = await this.sellerVerificationRepository.isVerifiedSeller(sellerKobaId);
    return this.calculateFee(amountCents, isVerifiedSeller);
  }
}
