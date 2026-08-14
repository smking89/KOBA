import { Inject, Injectable } from '@nestjs/common';
import { assertShopOwner } from './shop-authorization.util';
import { InvalidPromoPayoutConfigError } from './shop.errors';
import { SHOP_REPOSITORY, ShopRepository } from './shop.repository';
import { ShopService } from './shop.service';
import { PromoPayoutConfig, SetPromoSettingsParams, Shop } from './shop.types';

/**
 * Shop-side promo settings — ROADMAP.md Phase 4's "enable/disable
 * influencer eligibility for the shop's products, and set payout terms
 * (percentage or fixed rate)". Config only: actual referral-code
 * generation and payout execution is Phase 10 (Influencer System),
 * explicitly out of scope here — Phase 10 is expected to *read* these
 * settings, not this module to act on them.
 */
@Injectable()
export class ShopPromoService {
  constructor(
    private readonly shopService: ShopService,
    @Inject(SHOP_REPOSITORY) private readonly repository: ShopRepository,
  ) {}

  /**
   * Sets `promoEligible` plus a payout rate. Exactly one of
   * `percent`/`fixedCents` must be provided — both set or neither set
   * throws `InvalidPromoPayoutConfigError`. Only the shop's owner may
   * change these settings.
   */
  async setPromoSettings(shopId: string, callerKobaId: string, params: SetPromoSettingsParams): Promise<Shop> {
    const shop = await this.shopService.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    const promoPayout = this.buildPayoutConfig(params);

    return this.repository.save({ ...shop, promoEligible: params.promoEligible, promoPayout });
  }

  async getPromoSettings(shopId: string): Promise<{ promoEligible: boolean; payout: PromoPayoutConfig | null }> {
    const shop = await this.shopService.getById(shopId);
    return { promoEligible: shop.promoEligible, payout: shop.promoPayout };
  }

  private buildPayoutConfig(params: SetPromoSettingsParams): PromoPayoutConfig {
    const hasPercent = params.percent !== undefined && params.percent !== null;
    const hasFixed = params.fixedCents !== undefined && params.fixedCents !== null;

    if (hasPercent === hasFixed) {
      throw new InvalidPromoPayoutConfigError(
        hasPercent
          ? 'exactly one of percent/fixedCents must be set, both were provided'
          : 'exactly one of percent/fixedCents must be set, neither was provided',
      );
    }

    if (hasPercent) {
      const percent = params.percent as number;
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new InvalidPromoPayoutConfigError(`percent must be a number between 0 and 100, got ${percent}`);
      }
      return { kind: 'percent', percent };
    }

    const fixedCents = params.fixedCents as number;
    if (!Number.isInteger(fixedCents) || fixedCents < 0) {
      throw new InvalidPromoPayoutConfigError(
        `fixedCents must be a non-negative integer number of cents, got ${fixedCents}`,
      );
    }
    return { kind: 'fixed', fixedCents };
  }
}
