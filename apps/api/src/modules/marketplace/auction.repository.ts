import { Auction, Bid } from './marketplace.types';

/**
 * Storage seam for Auctions + their Bids. Bids are kept behind the same
 * repository as their auction (not a separate top-level DI token) since
 * every bid operation is scoped to a single auction.
 */
export const AUCTION_REPOSITORY = Symbol('AUCTION_REPOSITORY');

export interface AuctionRepository {
  findById(id: string): Promise<Auction | null>;
  /** The currently-active auction for a product, if any (enforces the
   * one-active-auction-per-product rule at the service layer). */
  findActiveByProductId(productId: string): Promise<Auction | null>;
  save(auction: Auction): Promise<Auction>;
  saveBid(bid: Bid): Promise<Bid>;
  findBidsByAuctionId(auctionId: string): Promise<Bid[]>;
  /** Highest bid on an auction so far, or null if none have been placed. */
  findHighestBid(auctionId: string): Promise<Bid | null>;
}
