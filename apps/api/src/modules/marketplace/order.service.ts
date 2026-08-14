import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AuctionNotEndedError,
  NoBidsPlacedError,
  NotHighestBidderError,
  ProductDelistedError,
  ProductHasActiveAuctionError,
} from './marketplace.errors';
import { BuyProductParams, Order, OrderSource } from './marketplace.types';
import { AuctionRepository, AUCTION_REPOSITORY } from './auction.repository';
import { AuctionService } from './auction.service';
import { ORDER_REPOSITORY, OrderRepository } from './order.repository';
import { ProductService } from './product.service';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository,
    @Inject(AUCTION_REPOSITORY) private readonly auctionRepository: AuctionRepository,
    private readonly productService: ProductService,
    private readonly auctionService: AuctionService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Fixed-price purchase of a non-auction product. Blocked if the product
   * is delisted or currently has an active auction, and blocked unless
   * the seller's Stripe Connect account is `active`.
   */
  async buyProduct(params: BuyProductParams): Promise<Order> {
    const product = await this.productService.getById(params.productId);

    if (product.delisted) {
      throw new ProductDelistedError(params.productId);
    }

    const activeAuction = await this.auctionRepository.findActiveByProductId(params.productId);
    if (activeAuction) {
      throw new ProductHasActiveAuctionError(params.productId);
    }

    await this.stripeConnectService.assertSellerCanReceivePayouts(product.sellerId);

    const order: Order = {
      id: randomUUID(),
      productId: product.id,
      buyerKobaId: params.buyerKobaId,
      sellerKobaId: product.sellerId,
      amountCents: product.priceCents,
      createdAt: new Date(),
      source: OrderSource.DIRECT,
    };

    return this.repository.save(order);
  }

  /**
   * Settles a won auction into an Order. Explicit action — nothing
   * auto-settles on the clock (no scheduler in this pass). Requires the
   * auction to have actually ended and the caller to be its highest
   * bidder, and the seller's Stripe Connect account to be `active`.
   */
  async settleAuction(auctionId: string, buyerKobaId: string): Promise<Order> {
    const auction = await this.auctionService.getById(auctionId);

    if (!this.auctionService.hasEnded(auction)) {
      throw new AuctionNotEndedError(auctionId);
    }

    const highestBid = await this.auctionService.getHighestBid(auctionId);
    if (!highestBid) {
      throw new NoBidsPlacedError(auctionId);
    }
    if (highestBid.bidderKobaId !== buyerKobaId) {
      throw new NotHighestBidderError(auctionId, buyerKobaId);
    }

    const product = await this.productService.getById(auction.productId);

    await this.stripeConnectService.assertSellerCanReceivePayouts(product.sellerId);

    await this.auctionService.markEnded(auctionId);

    const order: Order = {
      id: randomUUID(),
      productId: product.id,
      buyerKobaId,
      sellerKobaId: product.sellerId,
      amountCents: highestBid.amountCents,
      createdAt: new Date(),
      source: OrderSource.AUCTION,
    };

    return this.repository.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.repository.findById(id);
  }

  /**
   * Additive (Phase 4/Shops): all settled Orders for a seller KOBAID —
   * feeds shop analytics' revenue/order-count read-model. See
   * `OrderRepository#findBySellerKobaId` for why "settled" already
   * describes every `Order` row in this module.
   */
  async listBySellerKobaId(sellerKobaId: string): Promise<Order[]> {
    return this.repository.findBySellerKobaId(sellerKobaId);
  }
}
