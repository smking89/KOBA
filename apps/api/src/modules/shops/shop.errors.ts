/** Base class for all typed shops domain errors. */
export abstract class ShopDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when `ownerKobaId` doesn't match the KOBA-ROLE-CODE format. */
export class InvalidShopOwnerKobaIdFormatError extends ShopDomainError {
  constructor(ownerKobaId: string) {
    super(`"${ownerKobaId}" is not a valid KOBAID (expected format KOBA-ROLE-CODE)`);
  }
}

/**
 * Thrown when a Shop is created (or would be created) with a non-Business
 * owner KOBAID — a Player or Influencer KOBAID cannot own a Shop
 * (ROADMAP.md Phase 4).
 */
export class ShopOwnerMustBeBusinessRoleError extends ShopDomainError {
  constructor(ownerKobaId: string, role: string) {
    super(`KOBAID "${ownerKobaId}" has role "${role}", not Business (BZ) — only a Business-role KOBAID may own a Shop`);
  }
}

export class ShopNotFoundError extends ShopDomainError {
  constructor(shopId: string) {
    super(`Shop "${shopId}" was not found`);
  }
}

/** Thrown when a caller who isn't the shop's ownerKobaId tries to act as its owner. */
export class ShopNotOwnedByCallerError extends ShopDomainError {
  constructor(shopId: string, callerKobaId: string) {
    super(`KOBAID "${callerKobaId}" is not the owner of shop "${shopId}"`);
  }
}

/** Thrown when a product isn't attributed (via Product.shopId) to the shop it's being managed through. */
export class ProductNotPartOfShopError extends ShopDomainError {
  constructor(shopId: string, productId: string) {
    super(`Product "${productId}" is not attributed to shop "${shopId}"`);
  }
}

/**
 * Thrown when `SetPromoSettingsParams` specifies both `percent` and
 * `fixedCents`, or neither — exactly one is required (see
 * `shop.types.ts`'s `PromoPayoutConfig` discriminated union docstring).
 */
export class InvalidPromoPayoutConfigError extends ShopDomainError {
  constructor(reason: string) {
    super(`Invalid promo payout config: ${reason}`);
  }
}

/**
 * Thrown by `ShopStripeConnectService` when `initiateConnection()`/
 * `confirmConnection()` is called from a status that doesn't allow the
 * requested transition (notConnected -> pending -> active only).
 */
export class InvalidShopStripeStatusTransitionError extends ShopDomainError {
  constructor(shopId: string, from: string, to: string) {
    super(`Shop "${shopId}" cannot transition Stripe status from "${from}" to "${to}"`);
  }
}
