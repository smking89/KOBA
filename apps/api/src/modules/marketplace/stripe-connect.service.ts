import { Inject, Injectable } from '@nestjs/common';
import { InvalidMoneyAmountError, StripeAccountNotActiveError } from './marketplace.errors';
import { STRIPE_ACCOUNT_REPOSITORY, StripeAccountRepository } from './stripe-account.repository';
import { PLATFORM_FEE_RATE, PlatformFeeBreakdown, StripeAccountStatus } from './stripe-connect.types';

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
    @Inject(PLATFORM_FEE_RATE) private readonly platformFeeRate: number,
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
   * Pure platform-fee math for a settled order amount, using the
   * configurable rate injected via PLATFORM_FEE_RATE (never a hardcoded
   * magic constant here — the actual rate is an open client question,
   * see ROADMAP.md).
   */
  calculateFee(amountCents: number): PlatformFeeBreakdown {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new InvalidMoneyAmountError('amountCents', amountCents);
    }
    const platformFeeCents = Math.round(amountCents * this.platformFeeRate);
    const sellerPayoutCents = amountCents - platformFeeCents;
    return { platformFeeCents, sellerPayoutCents };
  }
}
