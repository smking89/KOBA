import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { InMemoryShopFollowerRepository } from './in-memory-shop-follower.repository';
import { InMemoryShopRepository } from './in-memory-shop.repository';
import { ShopAnalyticsService } from './shop-analytics.service';
import { SHOP_FOLLOWER_REPOSITORY } from './shop-follower.repository';
import { ShopFollowService } from './shop-follow.service';
import { ShopProductService } from './shop-product.service';
import { ShopPromoService } from './shop-promo.service';
import { SHOP_REPOSITORY } from './shop.repository';
import { ShopService } from './shop.service';
import { ShopStripeConnectService } from './shop-stripe-connect.service';

@Module({
  imports: [MarketplaceModule],
  providers: [
    ShopService,
    ShopPromoService,
    ShopAnalyticsService,
    ShopProductService,
    ShopFollowService,
    ShopStripeConnectService,
    { provide: SHOP_REPOSITORY, useClass: InMemoryShopRepository },
    { provide: SHOP_FOLLOWER_REPOSITORY, useClass: InMemoryShopFollowerRepository },
  ],
  exports: [
    ShopService,
    ShopPromoService,
    ShopAnalyticsService,
    ShopProductService,
    ShopFollowService,
    ShopStripeConnectService,
  ],
})
export class ShopsModule {}
