import { InMemoryAuctionRepository } from '../marketplace/in-memory-auction.repository';
import { InMemoryOrderRepository } from '../marketplace/in-memory-order.repository';
import { InMemoryProductRepository } from '../marketplace/in-memory-product.repository';
import { InMemorySellerVerificationRepository } from '../marketplace/in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from '../marketplace/in-memory-stripe-account.repository';
import { AuctionService } from '../marketplace/auction.service';
import { ProductCategory, RarityTier } from '../marketplace/marketplace.types';
import { OrderService } from '../marketplace/order.service';
import { ProductService } from '../marketplace/product.service';
import { StripeConnectService } from '../marketplace/stripe-connect.service';
import { StripeAccountStatus } from '../marketplace/stripe-connect.types';
import { InMemoryShopFollowerRepository } from './in-memory-shop-follower.repository';
import { InMemoryShopRepository } from './in-memory-shop.repository';
import { ShopAnalyticsService } from './shop-analytics.service';
import { ShopFollowService } from './shop-follow.service';
import { ShopProductService } from './shop-product.service';
import { ShopService } from './shop.service';

describe('ShopAnalyticsService', () => {
  let shopService: ShopService;
  let followService: ShopFollowService;
  let productService: ProductService;
  let orderService: OrderService;
  let stripeConnectService: StripeConnectService;
  let shopProductService: ShopProductService;
  let followerRepository: InMemoryShopFollowerRepository;
  let service: ShopAnalyticsService;

  const OWNER = 'KOBA-BZ-AAAA';
  const BUYER = 'KOBA-PL-BBBB';

  beforeEach(() => {
    const shopRepository = new InMemoryShopRepository();
    followerRepository = new InMemoryShopFollowerRepository();
    const productRepository = new InMemoryProductRepository();
    const orderRepository = new InMemoryOrderRepository();
    const auctionRepository = new InMemoryAuctionRepository();
    const stripeAccountRepository = new InMemoryStripeAccountRepository();
    const sellerVerificationRepository = new InMemorySellerVerificationRepository();

    shopService = new ShopService(shopRepository);
    followService = new ShopFollowService(shopService, followerRepository);
    productService = new ProductService(productRepository);
    const auctionService = new AuctionService(auctionRepository, productService);
    stripeConnectService = new StripeConnectService(
      stripeAccountRepository,
      { standardRate: 0.08, verifiedRate: 0.04 },
      sellerVerificationRepository,
    );
    orderService = new OrderService(orderRepository, auctionRepository, productService, auctionService, stripeConnectService);
    shopProductService = new ShopProductService(shopService, productService, stripeConnectService);
    service = new ShopAnalyticsService(shopService, productService, orderService, followerRepository);
  });

  async function setup() {
    const shop = await shopService.createShop({ ownerKobaId: OWNER, name: 'Oxide Outfitters' });
    await stripeConnectService.setStatus(OWNER, StripeAccountStatus.ACTIVE);
    return shop;
  }

  it('computes revenue, order count, follower count, and rarity distribution against seeded marketplace data', async () => {
    const shop = await setup();

    const common = await shopProductService.createProduct(shop.id, OWNER, {
      title: 'Common Skin',
      description: 'A common skin',
      game: 'Rust',
      category: ProductCategory.SKIN,
      rarity: RarityTier.COMMON,
      priceCents: 500,
    });
    const relic = await shopProductService.createProduct(shop.id, OWNER, {
      title: 'Relic Monument Kit',
      description: 'A relic monument kit',
      game: 'Rust',
      category: ProductCategory.MONUMENT,
      rarity: RarityTier.RELIC,
      priceCents: 10_000,
    });

    await orderService.buyProduct({ productId: common.id, buyerKobaId: BUYER });
    await orderService.buyProduct({ productId: relic.id, buyerKobaId: BUYER });

    await followService.follow(shop.id, BUYER);
    await followService.follow(shop.id, 'KOBA-PL-CCCC');

    const analytics = await service.getAnalytics(shop.id);

    expect(analytics.shopId).toBe(shop.id);
    expect(analytics.totalRevenueCents).toBe(10_500);
    expect(analytics.orderCount).toBe(2);
    expect(analytics.followerCount).toBe(2);
    expect(analytics.rarityDistribution[RarityTier.COMMON]).toBe(1);
    expect(analytics.rarityDistribution[RarityTier.RELIC]).toBe(1);
    expect(analytics.rarityDistribution[RarityTier.RARE]).toBe(0);
  });

  it('reports zero revenue/orders/followers for a shop with no activity', async () => {
    const shop = await setup();

    const analytics = await service.getAnalytics(shop.id);

    expect(analytics.totalRevenueCents).toBe(0);
    expect(analytics.orderCount).toBe(0);
    expect(analytics.followerCount).toBe(0);
    for (const tier of Object.values(RarityTier)) {
      expect(analytics.rarityDistribution[tier]).toBe(0);
    }
  });

  it('does not count another shop’s orders/products toward this shop’s analytics', async () => {
    const shop = await setup();
    const otherOwner = 'KOBA-BZ-DDDD';
    const otherShop = await shopService.createShop({ ownerKobaId: otherOwner, name: 'Other Shop' });
    await stripeConnectService.setStatus(otherOwner, StripeAccountStatus.ACTIVE);

    await shopProductService.createProduct(shop.id, OWNER, {
      title: 'This shop product',
      description: 'x',
      game: 'Rust',
      category: ProductCategory.SKIN,
      rarity: RarityTier.EPIC,
      priceCents: 100,
    });
    const otherProduct = await shopProductService.createProduct(otherShop.id, otherOwner, {
      title: 'Other shop product',
      description: 'x',
      game: 'Rust',
      category: ProductCategory.SKIN,
      rarity: RarityTier.LEGENDARY,
      priceCents: 200,
    });
    await orderService.buyProduct({ productId: otherProduct.id, buyerKobaId: BUYER });

    const analytics = await service.getAnalytics(shop.id);

    expect(analytics.totalRevenueCents).toBe(0);
    expect(analytics.orderCount).toBe(0);
    expect(analytics.rarityDistribution[RarityTier.EPIC]).toBe(1);
    expect(analytics.rarityDistribution[RarityTier.LEGENDARY]).toBe(0);
  });
});
