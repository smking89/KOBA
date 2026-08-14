import { Test } from '@nestjs/testing';
import { ShopAnalyticsService } from './shop-analytics.service';
import { ShopFollowService } from './shop-follow.service';
import { ShopProductService } from './shop-product.service';
import { ShopPromoService } from './shop-promo.service';
import { ShopService } from './shop.service';
import { ShopStripeConnectService } from './shop-stripe-connect.service';
import { ShopsModule } from './shops.module';

describe('ShopsModule (DI wiring)', () => {
  it('resolves every shops-module service through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ShopsModule],
    }).compile();

    expect(moduleRef.get(ShopService)).toBeInstanceOf(ShopService);
    expect(moduleRef.get(ShopPromoService)).toBeInstanceOf(ShopPromoService);
    expect(moduleRef.get(ShopAnalyticsService)).toBeInstanceOf(ShopAnalyticsService);
    expect(moduleRef.get(ShopProductService)).toBeInstanceOf(ShopProductService);
    expect(moduleRef.get(ShopFollowService)).toBeInstanceOf(ShopFollowService);
    expect(moduleRef.get(ShopStripeConnectService)).toBeInstanceOf(ShopStripeConnectService);

    await moduleRef.close();
  });
});
