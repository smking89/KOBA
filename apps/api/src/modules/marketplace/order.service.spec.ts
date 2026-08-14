import { InMemoryAuctionRepository } from './in-memory-auction.repository';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import { InMemoryProductRepository } from './in-memory-product.repository';
import { InMemorySellerVerificationRepository } from './in-memory-seller-verification.repository';
import { InMemoryStripeAccountRepository } from './in-memory-stripe-account.repository';
import {
  AuctionNotEndedError,
  NoBidsPlacedError,
  NotHighestBidderError,
  ProductDelistedError,
  ProductHasActiveAuctionError,
  StripeAccountNotActiveError,
} from './marketplace.errors';
import { AuctionService } from './auction.service';
import { OrderService } from './order.service';
import { ProductService } from './product.service';
import { StripeConnectService } from './stripe-connect.service';
import { CreateProductParams, OrderSource, ProductCategory, RarityTier } from './marketplace.types';
import { StripeAccountStatus } from './stripe-connect.types';

describe('OrderService', () => {
  let productRepository: InMemoryProductRepository;
  let auctionRepository: InMemoryAuctionRepository;
  let orderRepository: InMemoryOrderRepository;
  let stripeAccountRepository: InMemoryStripeAccountRepository;
  let sellerVerificationRepository: InMemorySellerVerificationRepository;
  let productService: ProductService;
  let auctionService: AuctionService;
  let stripeConnectService: StripeConnectService;
  let service: OrderService;

  const SELLER = 'KOBA-BZ-AAAA';
  const BUYER = 'KOBA-PL-BBBB';
  const OTHER_BIDDER = 'KOBA-PL-CCCC';

  beforeEach(() => {
    productRepository = new InMemoryProductRepository();
    auctionRepository = new InMemoryAuctionRepository();
    orderRepository = new InMemoryOrderRepository();
    stripeAccountRepository = new InMemoryStripeAccountRepository();
    sellerVerificationRepository = new InMemorySellerVerificationRepository();

    productService = new ProductService(productRepository);
    auctionService = new AuctionService(auctionRepository, productService);
    stripeConnectService = new StripeConnectService(
      stripeAccountRepository,
      { standardRate: 0.08, verifiedRate: 0.04 },
      sellerVerificationRepository,
    );
    service = new OrderService(
      orderRepository,
      auctionRepository,
      productService,
      auctionService,
      stripeConnectService,
    );
  });

  async function createProduct(overrides: Partial<CreateProductParams> = {}) {
    return productService.createProduct({
      sellerId: SELLER,
      title: 'Trader Skin Bundle',
      description: 'A bundle of skins',
      game: 'Rust',
      category: ProductCategory.SKIN,
      rarity: RarityTier.COMMON,
      priceCents: 800,
      ...overrides,
    });
  }

  async function activateSeller(sellerId = SELLER): Promise<void> {
    await stripeConnectService.setStatus(sellerId, StripeAccountStatus.ACTIVE);
  }

  function futureDate(msFromNow = 60_000): Date {
    return new Date(Date.now() + msFromNow);
  }

  function pastDate(msAgo = 1_000): Date {
    return new Date(Date.now() - msAgo);
  }

  describe('buyProduct (direct)', () => {
    it('completes a direct buy for a listed, non-auctioned product', async () => {
      const product = await createProduct();
      await activateSeller();

      const order = await service.buyProduct({ productId: product.id, buyerKobaId: BUYER });

      expect(order.productId).toBe(product.id);
      expect(order.buyerKobaId).toBe(BUYER);
      expect(order.sellerKobaId).toBe(SELLER);
      expect(order.amountCents).toBe(800);
      expect(order.source).toBe(OrderSource.DIRECT);
    });

    it('blocks a direct buy while the product has an active auction', async () => {
      const product = await createProduct();
      await activateSeller();
      await auctionService.startAuction({
        productId: product.id,
        startPriceCents: 500,
        minIncrementCents: 100,
        endsAt: futureDate(),
      });

      await expect(service.buyProduct({ productId: product.id, buyerKobaId: BUYER })).rejects.toThrow(
        ProductHasActiveAuctionError,
      );
    });

    it('blocks a direct buy on a delisted product', async () => {
      const product = await createProduct();
      await activateSeller();
      await productService.setDelisted(product.id, SELLER, true);

      await expect(service.buyProduct({ productId: product.id, buyerKobaId: BUYER })).rejects.toThrow(
        ProductDelistedError,
      );
    });

    it('blocks a direct buy when the seller Stripe account is not active', async () => {
      const product = await createProduct();

      await expect(service.buyProduct({ productId: product.id, buyerKobaId: BUYER })).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });
  });

  describe('settleAuction', () => {
    async function createEndedAuctionWithHighestBid() {
      const product = await createProduct();
      const auction = await auctionService.startAuction({
        productId: product.id,
        startPriceCents: 500,
        minIncrementCents: 100,
        endsAt: futureDate(500),
      });
      await auctionService.placeBid({
        auctionId: auction.id,
        bidderKobaId: OTHER_BIDDER,
        amountCents: 500,
      });
      await auctionService.placeBid({ auctionId: auction.id, bidderKobaId: BUYER, amountCents: 700 });

      // Simulate time passing by starting a fresh auction with an already-past endsAt
      // is not possible once bids exist against a future endsAt, so instead directly
      // re-save the auction with an ended endsAt via the repository the service uses.
      const stored = await auctionRepository.findById(auction.id);
      await auctionRepository.save({ ...stored!, endsAt: pastDate() });

      return { product, auction };
    }

    it('settles a won auction into an Order for the highest bidder', async () => {
      const { product, auction } = await createEndedAuctionWithHighestBid();
      await activateSeller();

      const order = await service.settleAuction(auction.id, BUYER);

      expect(order.productId).toBe(product.id);
      expect(order.buyerKobaId).toBe(BUYER);
      expect(order.sellerKobaId).toBe(SELLER);
      expect(order.amountCents).toBe(700);
      expect(order.source).toBe(OrderSource.AUCTION);
    });

    it('rejects settlement before the auction has ended', async () => {
      const product = await createProduct();
      const auction = await auctionService.startAuction({
        productId: product.id,
        startPriceCents: 500,
        minIncrementCents: 100,
        endsAt: futureDate(),
      });
      await auctionService.placeBid({ auctionId: auction.id, bidderKobaId: BUYER, amountCents: 500 });
      await activateSeller();

      await expect(service.settleAuction(auction.id, BUYER)).rejects.toThrow(AuctionNotEndedError);
    });

    it('rejects settlement when the caller is not the highest bidder', async () => {
      const { auction } = await createEndedAuctionWithHighestBid();
      await activateSeller();

      await expect(service.settleAuction(auction.id, OTHER_BIDDER)).rejects.toThrow(
        NotHighestBidderError,
      );
    });

    it('rejects settlement of an ended auction with no bids', async () => {
      const product = await createProduct();
      const auction = await auctionService.startAuction({
        productId: product.id,
        startPriceCents: 500,
        minIncrementCents: 100,
        endsAt: pastDate(),
      });
      await activateSeller();

      await expect(service.settleAuction(auction.id, BUYER)).rejects.toThrow(NoBidsPlacedError);
    });

    it('blocks settlement when the seller Stripe account is not active', async () => {
      const { auction } = await createEndedAuctionWithHighestBid();

      await expect(service.settleAuction(auction.id, BUYER)).rejects.toThrow(
        StripeAccountNotActiveError,
      );
    });
  });
});
