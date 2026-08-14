import { Inject, Injectable } from '@nestjs/common';
import { RARITY_TIERS, RarityTier } from '../marketplace/marketplace.types';
import { OrderService } from '../marketplace/order.service';
import { ProductService } from '../marketplace/product.service';
import { SHOP_FOLLOWER_REPOSITORY, ShopFollowerRepository } from './shop-follower.repository';
import { ShopService } from './shop.service';
import { ShopAnalytics } from './shop.types';

/**
 * Read-model computed from existing marketplace data — ROADMAP.md Phase 4:
 * total revenue, order count, follower count, and rarity distribution for
 * a shop. Reads through marketplace's `ProductService#listByShopId()` and
 * `OrderService#listBySellerKobaId()` (both additive, see
 * marketplace/README.md) rather than re-implementing storage — same
 * cross-module DI pattern as `accounts/account-switch.service.ts`
 * injecting `kobaid/kobaid.service.ts`'s `KobaidService`.
 */
@Injectable()
export class ShopAnalyticsService {
  constructor(
    private readonly shopService: ShopService,
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
    @Inject(SHOP_FOLLOWER_REPOSITORY) private readonly followerRepository: ShopFollowerRepository,
  ) {}

  async getAnalytics(shopId: string): Promise<ShopAnalytics> {
    const shop = await this.shopService.getById(shopId);

    const [products, orders, followerCount] = await Promise.all([
      this.productService.listByShopId(shopId),
      this.orderService.listBySellerKobaId(shop.ownerKobaId),
      this.followerRepository.countByShop(shopId),
    ]);

    // Integer cents throughout — never a float, matching every other
    // money computation in this codebase.
    const totalRevenueCents = orders.reduce((sum, order) => sum + order.amountCents, 0);

    return {
      shopId,
      totalRevenueCents,
      orderCount: orders.length,
      followerCount,
      rarityDistribution: this.computeRarityDistribution(products.map((product) => product.rarity)),
    };
  }

  private computeRarityDistribution(rarities: readonly RarityTier[]): Record<string, number> {
    const distribution = Object.fromEntries(RARITY_TIERS.map((tier) => [tier, 0])) as Record<string, number>;
    for (const rarity of rarities) {
      distribution[rarity] += 1;
    }
    return distribution;
  }
}
