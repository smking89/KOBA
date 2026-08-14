import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ActiveAuctionExistsError,
  AuctionEndedError,
  AuctionNotFoundError,
  BidTooLowError,
  InvalidMoneyAmountError,
  SellerCannotBidOwnAuctionError,
} from './marketplace.errors';
import { Auction, AuctionStatus, Bid, PlaceBidParams, StartAuctionParams } from './marketplace.types';
import { AUCTION_REPOSITORY, AuctionRepository } from './auction.repository';
import { ProductService } from './product.service';

@Injectable()
export class AuctionService {
  constructor(
    @Inject(AUCTION_REPOSITORY) private readonly repository: AuctionRepository,
    private readonly productService: ProductService,
  ) {}

  /**
   * Starts a new auction for a product. Only one active auction per
   * product at a time — throws ActiveAuctionExistsError otherwise.
   */
  async startAuction(params: StartAuctionParams): Promise<Auction> {
    if (!Number.isInteger(params.startPriceCents) || params.startPriceCents < 0) {
      throw new InvalidMoneyAmountError('startPriceCents', params.startPriceCents);
    }
    if (!Number.isInteger(params.minIncrementCents) || params.minIncrementCents <= 0) {
      throw new InvalidMoneyAmountError('minIncrementCents', params.minIncrementCents);
    }

    const product = await this.productService.getById(params.productId);

    const existingActive = await this.repository.findActiveByProductId(params.productId);
    if (existingActive) {
      throw new ActiveAuctionExistsError(params.productId);
    }

    const auction: Auction = {
      id: randomUUID(),
      productId: params.productId,
      sellerId: product.sellerId,
      startPriceCents: params.startPriceCents,
      minIncrementCents: params.minIncrementCents,
      endsAt: params.endsAt,
      status: AuctionStatus.ACTIVE,
      createdAt: new Date(),
    };

    return this.repository.save(auction);
  }

  async getById(auctionId: string): Promise<Auction> {
    const auction = await this.repository.findById(auctionId);
    if (!auction) {
      throw new AuctionNotFoundError(auctionId);
    }
    return auction;
  }

  async getHighestBid(auctionId: string): Promise<Bid | null> {
    await this.getById(auctionId);
    return this.repository.findHighestBid(auctionId);
  }

  /** No background scheduler in this pass — this just checks the clock. */
  hasEnded(auction: Auction): boolean {
    return auction.status === AuctionStatus.ENDED || auction.endsAt.getTime() <= Date.now();
  }

  async placeBid(params: PlaceBidParams): Promise<Bid> {
    if (!Number.isInteger(params.amountCents) || params.amountCents < 0) {
      throw new InvalidMoneyAmountError('amountCents', params.amountCents);
    }

    const auction = await this.getById(params.auctionId);

    if (this.hasEnded(auction)) {
      throw new AuctionEndedError(params.auctionId);
    }

    if (params.bidderKobaId === auction.sellerId) {
      throw new SellerCannotBidOwnAuctionError(params.auctionId);
    }

    const highestBid = await this.repository.findHighestBid(params.auctionId);
    const minimumAmountCents = highestBid
      ? highestBid.amountCents + auction.minIncrementCents
      : auction.startPriceCents;

    if (params.amountCents < minimumAmountCents) {
      throw new BidTooLowError(params.auctionId, minimumAmountCents);
    }

    const bid: Bid = {
      id: randomUUID(),
      auctionId: params.auctionId,
      bidderKobaId: params.bidderKobaId,
      amountCents: params.amountCents,
      placedAt: new Date(),
    };

    return this.repository.saveBid(bid);
  }

  /** Marks an auction ended. Called explicitly by settlement — no
   * background job/scheduler auto-flips this in this pass. */
  async markEnded(auctionId: string): Promise<Auction> {
    const auction = await this.getById(auctionId);
    if (auction.status === AuctionStatus.ENDED) {
      return auction;
    }
    return this.repository.save({ ...auction, status: AuctionStatus.ENDED });
  }
}
