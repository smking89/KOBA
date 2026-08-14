import { Injectable } from '@nestjs/common';
import { AuctionRepository } from './auction.repository';
import { Auction, AuctionStatus, Bid } from './marketplace.types';

@Injectable()
export class InMemoryAuctionRepository implements AuctionRepository {
  private readonly byId = new Map<string, Auction>();
  private readonly bidsByAuctionId = new Map<string, Bid[]>();

  async findById(id: string): Promise<Auction | null> {
    return this.byId.get(id) ?? null;
  }

  async findActiveByProductId(productId: string): Promise<Auction | null> {
    for (const auction of this.byId.values()) {
      if (auction.productId === productId && auction.status === AuctionStatus.ACTIVE) {
        return auction;
      }
    }
    return null;
  }

  async save(auction: Auction): Promise<Auction> {
    this.byId.set(auction.id, auction);
    return auction;
  }

  async saveBid(bid: Bid): Promise<Bid> {
    const existing = this.bidsByAuctionId.get(bid.auctionId) ?? [];
    existing.push(bid);
    this.bidsByAuctionId.set(bid.auctionId, existing);
    return bid;
  }

  async findBidsByAuctionId(auctionId: string): Promise<Bid[]> {
    return [...(this.bidsByAuctionId.get(auctionId) ?? [])];
  }

  async findHighestBid(auctionId: string): Promise<Bid | null> {
    const bids = this.bidsByAuctionId.get(auctionId) ?? [];
    if (bids.length === 0) {
      return null;
    }
    return bids.reduce((highest, bid) => (bid.amountCents > highest.amountCents ? bid : highest));
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
    this.bidsByAuctionId.clear();
  }
}
