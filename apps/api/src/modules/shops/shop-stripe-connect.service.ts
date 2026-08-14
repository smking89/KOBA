import { Injectable } from '@nestjs/common';
import { StripeConnectService } from '../marketplace/stripe-connect.service';
import { StripeAccountStatus } from '../marketplace/stripe-connect.types';
import { assertShopOwner } from './shop-authorization.util';
import { InvalidShopStripeStatusTransitionError } from './shop.errors';
import { ShopService } from './shop.service';

/**
 * Shop-level wrapper around marketplace's existing (structural-only, no
 * real Stripe API calls) `StripeConnectService` — ROADMAP.md Phase 4's
 * Stripe Connect onboarding flow, matching Phase 3's explicit non-goal of
 * not calling real Stripe. Keyed by `Shop.ownerKobaId` — a shop's
 * products are always listed with `sellerId === shop.ownerKobaId` (see
 * `ShopProductService`), so this reuses marketplace's existing per-seller
 * status + gating (`assertSellerCanReceivePayouts()`) rather than
 * reimplementing a parallel state machine.
 */
@Injectable()
export class ShopStripeConnectService {
  constructor(
    private readonly shopService: ShopService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  async getStatus(shopId: string): Promise<StripeAccountStatus> {
    const shop = await this.shopService.getById(shopId);
    return this.stripeConnectService.getStatus(shop.ownerKobaId);
  }

  /** notConnected -> pending. Only the shop's owner may initiate. */
  async initiateConnection(shopId: string, callerKobaId: string): Promise<StripeAccountStatus> {
    const shop = await this.shopService.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    const current = await this.stripeConnectService.getStatus(shop.ownerKobaId);
    if (current !== StripeAccountStatus.NOT_CONNECTED) {
      throw new InvalidShopStripeStatusTransitionError(shopId, current, StripeAccountStatus.PENDING);
    }

    await this.stripeConnectService.setStatus(shop.ownerKobaId, StripeAccountStatus.PENDING);
    return StripeAccountStatus.PENDING;
  }

  /** pending -> active. Only the shop's owner may confirm. */
  async confirmConnection(shopId: string, callerKobaId: string): Promise<StripeAccountStatus> {
    const shop = await this.shopService.getById(shopId);
    assertShopOwner(shop, callerKobaId);

    const current = await this.stripeConnectService.getStatus(shop.ownerKobaId);
    if (current !== StripeAccountStatus.PENDING) {
      throw new InvalidShopStripeStatusTransitionError(shopId, current, StripeAccountStatus.ACTIVE);
    }

    await this.stripeConnectService.setStatus(shop.ownerKobaId, StripeAccountStatus.ACTIVE);
    return StripeAccountStatus.ACTIVE;
  }
}
