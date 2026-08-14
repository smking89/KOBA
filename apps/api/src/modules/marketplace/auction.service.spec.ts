import { InMemoryAuctionRepository } from './in-memory-auction.repository';
import { InMemoryProductRepository } from './in-memory-product.repository';
import {
  ActiveAuctionExistsError,
  AuctionEndedError,
  AuctionNotFoundError,
  BidTooLowError,
  SellerCannotBidOwnAuctionError,
} from './marketplace.errors';
import { AuctionService } from './auction.service';
import { ProductService } from './product.service';
import { CreateProductParams, ProductCategory, RarityTier } from './marketplace.types';

describe('AuctionService', () => {
  let productRepository: InMemoryProductRepository;
  let auctionRepository: InMemoryAuctionRepository;
  let productService: ProductService;
  let service: AuctionService;

  const SELLER = 'KOBA-BZ-AAAA';
  const BIDDER_A = 'KOBA-PL-BBBB';
  const BIDDER_B = 'KOBA-PL-CCCC';

  beforeEach(() => {
    productRepository = new InMemoryProductRepository();
    auctionRepository = new InMemoryAuctionRepository();
    productService = new ProductService(productRepository);
    service = new AuctionService(auctionRepository, productService);
  });

  async function createProduct(overrides: Partial<CreateProductParams> = {}) {
    return productService.createProduct({
      sellerId: SELLER,
      title: "The Iron Wright's Relic Monument",
      description: '1-of-1 custom monument',
      game: 'Rust',
      category: ProductCategory.MONUMENT,
      rarity: RarityTier.RELIC,
      priceCents: 100_000,
      ...overrides,
    });
  }

  function futureDate(msFromNow = 60_000): Date {
    return new Date(Date.now() + msFromNow);
  }

  function pastDate(msAgo = 1_000): Date {
    return new Date(Date.now() - msAgo);
  }

  describe('startAuction', () => {
    it('starts an active auction for a product', async () => {
      const product = await createProduct();

      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      expect(auction.productId).toBe(product.id);
      expect(auction.sellerId).toBe(SELLER);
      expect(auction.status).toBe('active');
    });

    it('rejects a second active auction for the same product', async () => {
      const product = await createProduct();
      await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      await expect(
        service.startAuction({
          productId: product.id,
          startPriceCents: 60_000,
          minIncrementCents: 5_000,
          endsAt: futureDate(),
        }),
      ).rejects.toThrow(ActiveAuctionExistsError);
    });

    it('allows a new auction once the previous one has been marked ended', async () => {
      const product = await createProduct();
      const first = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });
      await service.markEnded(first.id);

      const second = await service.startAuction({
        productId: product.id,
        startPriceCents: 60_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe('active');
    });
  });

  describe('placeBid', () => {
    it('accepts a bid meeting the start price when there are no prior bids', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      const bid = await service.placeBid({
        auctionId: auction.id,
        bidderKobaId: BIDDER_A,
        amountCents: 50_000,
      });

      expect(bid.amountCents).toBe(50_000);
      expect(bid.bidderKobaId).toBe(BIDDER_A);
    });

    it('rejects a bid below the start price', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      await expect(
        service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_A, amountCents: 49_999 }),
      ).rejects.toThrow(BidTooLowError);
    });

    it('requires a subsequent bid to meet the increment over the highest bid', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });
      await service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_A, amountCents: 50_000 });

      await expect(
        service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_B, amountCents: 54_999 }),
      ).rejects.toThrow(BidTooLowError);

      const accepted = await service.placeBid({
        auctionId: auction.id,
        bidderKobaId: BIDDER_B,
        amountCents: 55_000,
      });
      expect(accepted.amountCents).toBe(55_000);
    });

    it('tracks the current highest bid', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });
      await service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_A, amountCents: 50_000 });
      await service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_B, amountCents: 60_000 });

      const highest = await service.getHighestBid(auction.id);
      expect(highest?.bidderKobaId).toBe(BIDDER_B);
      expect(highest?.amountCents).toBe(60_000);
    });

    it('rejects bids after endsAt has passed', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: pastDate(),
      });

      await expect(
        service.placeBid({ auctionId: auction.id, bidderKobaId: BIDDER_A, amountCents: 50_000 }),
      ).rejects.toThrow(AuctionEndedError);
    });

    it('rejects the seller bidding on their own auction', async () => {
      const product = await createProduct();
      const auction = await service.startAuction({
        productId: product.id,
        startPriceCents: 50_000,
        minIncrementCents: 5_000,
        endsAt: futureDate(),
      });

      await expect(
        service.placeBid({ auctionId: auction.id, bidderKobaId: SELLER, amountCents: 50_000 }),
      ).rejects.toThrow(SellerCannotBidOwnAuctionError);
    });

    it('throws AuctionNotFoundError for an unknown auction', async () => {
      await expect(
        service.placeBid({ auctionId: 'nope', bidderKobaId: BIDDER_A, amountCents: 1_000 }),
      ).rejects.toThrow(AuctionNotFoundError);
    });
  });
});
