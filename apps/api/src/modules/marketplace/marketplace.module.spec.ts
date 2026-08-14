import { Test } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { MarketplaceModule } from './marketplace.module';
import { OrderService } from './order.service';
import { ProductService } from './product.service';
import { StripeConnectService } from './stripe-connect.service';

describe('MarketplaceModule (DI wiring)', () => {
  it('resolves ProductService, AuctionService, OrderService and StripeConnectService through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MarketplaceModule],
    }).compile();

    expect(moduleRef.get(ProductService)).toBeInstanceOf(ProductService);
    expect(moduleRef.get(AuctionService)).toBeInstanceOf(AuctionService);
    expect(moduleRef.get(OrderService)).toBeInstanceOf(OrderService);
    expect(moduleRef.get(StripeConnectService)).toBeInstanceOf(StripeConnectService);

    await moduleRef.close();
  });
});
