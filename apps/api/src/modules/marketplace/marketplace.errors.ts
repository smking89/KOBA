/** Base class for all typed marketplace domain errors. */
export abstract class MarketplaceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedGameError extends MarketplaceDomainError {
  constructor(game: string) {
    super(`"${game}" is not a supported game — see marketplace/marketplace.types.ts SUPPORTED_GAMES`);
  }
}

export class InvalidProductCategoryError extends MarketplaceDomainError {
  constructor(category: string) {
    super(`"${category}" is not a valid product category`);
  }
}

export class InvalidRarityTierError extends MarketplaceDomainError {
  constructor(rarity: string) {
    super(`"${rarity}" is not a valid rarity tier`);
  }
}

/** Thrown when a COSMETIC product is created without a cosmeticType. */
export class CosmeticTypeRequiredError extends MarketplaceDomainError {
  constructor() {
    super('Cosmetic products require a cosmeticType (avatarDecoration | profileEffect | nameplate)');
  }
}

/** Thrown when a non-COSMETIC product is created with a cosmeticType. */
export class CosmeticTypeNotAllowedError extends MarketplaceDomainError {
  constructor(category: string) {
    super(`cosmeticType is only allowed on category "cosmetic", not "${category}"`);
  }
}

export class InvalidCosmeticTypeError extends MarketplaceDomainError {
  constructor(cosmeticType: string) {
    super(`"${cosmeticType}" is not a valid cosmetic type`);
  }
}

/** Thrown when priceCents/amountCents is not a non-negative integer. */
export class InvalidMoneyAmountError extends MarketplaceDomainError {
  constructor(fieldName: string, value: number) {
    super(`${fieldName} must be a non-negative integer number of cents, got ${value}`);
  }
}

export class ProductNotFoundError extends MarketplaceDomainError {
  constructor(productId: string) {
    super(`Product "${productId}" was not found`);
  }
}

/** Thrown when a caller who isn't the listing product's seller tries to delist it. */
export class ProductNotOwnedByCallerError extends MarketplaceDomainError {
  constructor(productId: string, callerKobaId: string) {
    super(`KOBAID "${callerKobaId}" is not the seller of product "${productId}"`);
  }
}

/** Thrown by direct Buy when the product has been delisted. */
export class ProductDelistedError extends MarketplaceDomainError {
  constructor(productId: string) {
    super(`Product "${productId}" is delisted and cannot be purchased`);
  }
}

/** Thrown by direct Buy when the product currently has an active auction. */
export class ProductHasActiveAuctionError extends MarketplaceDomainError {
  constructor(productId: string) {
    super(`Product "${productId}" is currently up for auction and cannot be bought directly`);
  }
}

export class AuctionNotFoundError extends MarketplaceDomainError {
  constructor(auctionId: string) {
    super(`Auction "${auctionId}" was not found`);
  }
}

/** Thrown when starting a second active auction for a product that already has one. */
export class ActiveAuctionExistsError extends MarketplaceDomainError {
  constructor(productId: string) {
    super(`Product "${productId}" already has an active auction`);
  }
}

/** Thrown when a bid is placed on an auction that has already ended (status or endsAt). */
export class AuctionEndedError extends MarketplaceDomainError {
  constructor(auctionId: string) {
    super(`Auction "${auctionId}" has ended and no longer accepts bids`);
  }
}

/** Thrown when settleAuction() is called before the auction's endsAt has passed. */
export class AuctionNotEndedError extends MarketplaceDomainError {
  constructor(auctionId: string) {
    super(`Auction "${auctionId}" has not ended yet and cannot be settled`);
  }
}

/** Thrown when a bid does not exceed the current highest bid (or start price) by minIncrement. */
export class BidTooLowError extends MarketplaceDomainError {
  constructor(auctionId: string, minimumAmountCents: number) {
    super(`Bid on auction "${auctionId}" must be at least ${minimumAmountCents} cents`);
  }
}

export class SellerCannotBidOwnAuctionError extends MarketplaceDomainError {
  constructor(auctionId: string) {
    super(`The seller cannot bid on their own auction "${auctionId}"`);
  }
}

/** Thrown by settleAuction() when the auction has ended with no bids placed. */
export class NoBidsPlacedError extends MarketplaceDomainError {
  constructor(auctionId: string) {
    super(`Auction "${auctionId}" has no bids and cannot be settled`);
  }
}

/** Thrown by settleAuction() when the caller isn't the auction's highest bidder. */
export class NotHighestBidderError extends MarketplaceDomainError {
  constructor(auctionId: string, callerKobaId: string) {
    super(`KOBAID "${callerKobaId}" is not the highest bidder on auction "${auctionId}"`);
  }
}

/**
 * Thrown when an Order/settlement is attempted but the seller's
 * StripeAccountStatus is not `active` (structural-only Stripe Connect
 * model — see stripe-connect.service.ts).
 */
export class StripeAccountNotActiveError extends MarketplaceDomainError {
  constructor(sellerKobaId: string) {
    super(`Seller "${sellerKobaId}" does not have an active Stripe Connect account`);
  }
}
