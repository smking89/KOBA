# marketplace

**Phase:** Phase 3
**Status:** implemented (service/DI layer, no HTTP routes yet — same
posture as Phase 1's kobaid module)

Products, cosmetics (Avatar Decoration / Profile Effect / Nameplate —
sold pre-made, never built), auctions, bids, orders, rarity, and a
structural-only Stripe Connect model (account status + platform-fee
math — no real Stripe API calls).

## What's here

- `marketplace.types.ts` — `RarityTier` (six-tier ladder: common →
  uncommon → rare → epic → legendary → relic, matching
  `design/ui-ux-design-system.html`'s `.rarity-chip` classes exactly),
  `ProductCategory` (skin | map | monument | asset | cosmetic),
  `CosmeticType` (avatarDecoration | profileEffect | nameplate — exactly
  these three, per ROADMAP.md Phase 0/9's "cosmetics are pre-made and
  sold, never built" rule), `SUPPORTED_GAMES` (allowlist sample from the
  root README's "Supported games" list, not an exhaustive enum), and the
  `Product`/`Auction`/`Bid`/`Order` shapes + their create/action param
  types. Money is always an integer number of cents (`priceCents`,
  `amountCents`, ...) — never a float, anywhere in this module.
- `marketplace.errors.ts` — typed domain errors (`MarketplaceDomainError`
  base class, same pattern as `kobaid/kobaid.errors.ts`): game/category/
  rarity/cosmeticType validation errors, `ProductNotFoundError`,
  `ProductNotOwnedByCallerError`, `ProductDelistedError`,
  `ProductHasActiveAuctionError`, `ActiveAuctionExistsError`,
  `AuctionEndedError`, `AuctionNotEndedError`, `BidTooLowError`,
  `SellerCannotBidOwnAuctionError`, `NoBidsPlacedError`,
  `NotHighestBidderError`, `StripeAccountNotActiveError`.
- `product.repository.ts` / `in-memory-product.repository.ts`,
  `auction.repository.ts` / `in-memory-auction.repository.ts` (auctions
  + their bids, one repository since every bid operation is scoped to a
  single auction), `order.repository.ts` / `in-memory-order.repository.ts`,
  `stripe-account.repository.ts` / `in-memory-stripe-account.repository.ts`
  — interface-behind-in-memory-implementation, same pattern and same
  storage decision as `kobaid/kobaid.repository.ts` (see "Storage
  decision" below).
- `product.service.ts` — `ProductService`:
  - `createProduct()` — validates `game` against `SUPPORTED_GAMES`,
    `category`/`rarity` against their enums, `priceCents` as a
    non-negative integer, and enforces the cosmetic/category pairing
    (`CosmeticTypeRequiredError` if `category === cosmetic` and no
    `cosmeticType`; `CosmeticTypeNotAllowedError` the other way around).
  - `getById()` / `findById()`.
  - `listByShopId()` — additive (Phase 4/Shops): all products attributed
    to a given shop via `Product.shopId`. See "Phase 4 additions" below.
  - `setDelisted(productId, callerKobaId, delisted)` — the soft delist
    toggle. Delist ≠ delete: the product stays fetchable and its order
    history stays intact; there is deliberately no hard-delete method
    anywhere in this module. Only the listing's seller may toggle it
    (`ProductNotOwnedByCallerError` otherwise).
- `auction.service.ts` — `AuctionService`:
  - `startAuction()` — enforces one active auction per product
    (`ActiveAuctionExistsError` on a second attempt while one's active).
  - `placeBid()` — a bid must be ≥ current highest bid + `minIncrement`
    (or ≥ `startPriceCents` with no bids yet — `BidTooLowError`
    otherwise), must be placed before `endsAt`
    (`AuctionEndedError` otherwise — checked against the clock at bid
    time, **no background job/scheduler auto-flips status in this
    pass**, see "Explicitly out of scope" below), and the seller cannot
    bid on their own auction (`SellerCannotBidOwnAuctionError`).
  - `getHighestBid()` / `hasEnded()` (clock-only check: `status ===
    ended || endsAt <= now`) / `markEnded()` (explicit, called by
    `OrderService#settleAuction()` — never automatic).
- `order.service.ts` — `OrderService`:
  - `buyProduct()` — a direct Buy. Blocked if the product is delisted
    (`ProductDelistedError`) or currently has an active auction
    (`ProductHasActiveAuctionError`), and blocked unless the seller's
    Stripe Connect account status is `active`
    (`StripeAccountNotActiveError`).
  - `settleAuction(auctionId, buyerKobaId)` — explicit settlement, never
    automatic. Requires the auction to have actually ended
    (`AuctionNotEndedError` otherwise), requires at least one bid
    (`NoBidsPlacedError`), requires the caller to be the highest bidder
    (`NotHighestBidderError` otherwise), and requires the seller's
    Stripe Connect account to be `active`. On success it marks the
    auction `ended` and creates an `Order` with `source: 'auction'`.
  - `listBySellerKobaId()` — additive (Phase 4/Shops): all settled Orders
    for a seller KOBAID. See "Phase 4 additions" below.
- `stripe-connect.service.ts` / `stripe-account.repository.ts` /
  `stripe-connect.types.ts` — `StripeConnectService`: structural-only
  Stripe Connect model.
  - `getStatus()` / `setStatus()` — per-seller-KOBAID
    `StripeAccountStatus` (`notConnected | pending | active` — the three
    states shown in the Phase 0 design's Stripe Connection screen).
  - `assertSellerCanReceivePayouts()` — throws
    `StripeAccountNotActiveError` unless `active`; called by both
    `OrderService` paths above.
  - `calculateFee(amountCents, isVerifiedSeller)` — pure platform-fee
    math, returns `{ platformFeeCents, sellerPayoutCents }`. Two-tier
    rate schedule (**8% standard, 4% for Blue-Badge-verified shops**,
    per `roadmap/platform-fee-research.md` §2) injected via the
    `PLATFORM_FEE_RATE_SCHEDULE` DI token — never a hardcoded magic
    constant inside the calculation itself.
  - `calculateFeeForSeller(sellerKobaId, amountCents)` — same math, but
    resolves the seller's verification status via
    `SELLER_VERIFICATION_REPOSITORY` at call time, so settlement code
    always reads the seller's Blue Badge status *as of settlement time*,
    never a value cached from an earlier checkout step (Blue Badge can be
    revoked mid-cycle).
- `seller-verification.repository.ts` /
  `in-memory-seller-verification.repository.ts` — `SellerVerificationRepository`:
  the minimum seam `StripeConnectService` needs to ask "is this seller
  currently Blue-Badge-verified?" without depending on Phase 9's
  (Developer Portal) real `BlueBadgeGrant` model, which doesn't exist as a
  module yet. Same interface-behind-in-memory-implementation pattern as
  every other repository here; Phase 9 can later add a real
  implementation with no change to this module's shape.
- `marketplace.module.ts` — Nest module wiring `ProductService` /
  `AuctionService` / `OrderService` / `StripeConnectService` behind their
  repository DI tokens, plus `PLATFORM_FEE_RATE_SCHEDULE` and
  `SELLER_VERIFICATION_REPOSITORY`. **Not yet imported by `AppModule`** —
  wiring it in is a follow-up task, out of this task's scope (only
  `apps/api/src/modules/marketplace/` and
  `packages/database/prisma/schema.prisma` were touched).

## Storage decision: in-memory repositories, not Prisma, this phase

Same rationale and pattern as `kobaid/kobaid.repository.ts` — see that
module's README. `ProductRepository`, `AuctionRepository`,
`OrderRepository`, and `StripeAccountRepository` are interfaces;
`InMemory*` classes are the only implementations wired up right now.
`Product`, `Auction`, `Bid`, `Order`, and `StripeAccount` Prisma models
(plus `RarityTier`/`ProductCategory`/`CosmeticType`/`AuctionStatus`/
`OrderSource`/`StripeAccountStatus` enums) were added to
`packages/database/prisma/schema.prisma` — additive only, validated with
`prisma validate` — so the target shape is locked in ahead of Phase 12.
`apps/api` still has no `@prisma/client` dependency or generated client;
wiring Prisma-backed repositories is a later-phase follow-up.

## Explicitly out of scope this phase (left for later)

- **Real Stripe integration** — no `stripe` SDK dependency, no real
  charge creation, no webhook handling, no actual Connect
  onboarding/account-link flow. `StripeConnectService` only models
  account *status* and fee *math*. Wiring the real API (and reading
  verification status back, per ROADMAP.md's Phase 4 "no government ID
  stored" constraint) is a real Stripe integration task for later —
  same spirit as how the kobaid module left TDLS as a TODO until the
  client defined it.
- **Platform fee rate** — resolved. Per
  `roadmap/platform-fee-research.md` §2, the rate is a real, decided
  two-tier percentage: **8% for unverified/regular shops, 4% for
  Blue-Badge-verified shops**, wired in `marketplace.module.ts` via the
  `PLATFORM_FEE_RATE_SCHEDULE` DI token
  (`{ standardRate: 0.08, verifiedRate: 0.04 }`). Still threaded through
  as DI configuration (never a hardcoded magic constant inside
  `StripeConnectService`'s logic), so a future pricing review only
  touches module wiring. Two related ideas from the same research doc
  are explicitly **still open, not implemented here**:
  - **Fee cap for high-value auctions** (research doc §3) — an
    unresolved judgment call (illustrative $75/$40 ceiling figures, no
    hard precedent found), flagged as a "build the config field, decide
    the exact ceiling with real sales data" follow-up.
  - **Minimum listing price for cheap cosmetics** (research doc §4) — a
    catalog-policy question about Stripe's $0.30 fixed fee dominating a
    $2.50 item, not something this module's fee math should try to
    solve.
- **Auction auto-close scheduler** — ROADMAP.md recommends an
  auto-extend-on-last-second-bid rule and flags auction end-time as
  something a background sweep (BullMQ, per the tech stack) should
  eventually own. This phase only checks the clock at bid/settlement
  time (`AuctionService#hasEnded()`); there is no background job that
  flips `status` to `ended` on its own, and no auto-extend behavior.
  Both are follow-ups once Redis/BullMQ are wired up (Phase 8's
  infrastructure).
- **Shops-module seller identity** — `sellerId`/`sellerKobaId` here are
  still plain KOBAID strings (a Business or Player KOBAID, per
  ROADMAP.md Phase 0 showing both selling); this module never validates
  them against a real `Shop` or `KobaId` record. Phase 4 (Shops, see
  `apps/api/src/modules/shops/`) extended (not replaced) this shape with
  the additive `Product.shopId` pointer below — a shop's products still
  carry `sellerId === shop.ownerKobaId`, `shopId` is purely additional
  attribution.

## Phase 4 additions (Shops)

`apps/api/src/modules/shops/` needed a small, additive-only extension of
this module rather than reimplementing Product/Order storage — see that
module's README for the full shops-side design. Exactly these changes
were made here:

- `marketplace.types.ts` — `Product.shopId: string | null` (and
  `CreateProductParams.shopId?`), optional and defaulting to `null` for
  every product not created through a shop. This module does not
  validate `shopId` against a real `Shop` record — that's the shops
  module's job.
- `product.repository.ts` / `in-memory-product.repository.ts` — added
  `findByShopId(shopId)`.
- `product.service.ts` — added `listByShopId(shopId)` (thin wrapper).
- `order.repository.ts` / `in-memory-order.repository.ts` — added
  `findBySellerKobaId(sellerKobaId)`.
- `order.service.ts` — added `listBySellerKobaId(sellerKobaId)` (thin
  wrapper) — feeds shops' `ShopAnalyticsService` revenue/order-count
  computation.

No other file in this module was touched; every existing test in this
module (51 of them) still passes unmodified.
- **HTTP controllers/routes** — same as kobaid: Phase 13 decides the
  route surface (`/marketplace/products`, `/marketplace/auctions`,
  `/marketplace/orders`, ...), gated by Phase 11's RBAC / Phase 1-2's
  capability flags (`marketplaceBuy`/`marketplaceBid`, already present
  in `accounts/capability.service.ts`'s `PLAYER_CAPABILITIES`).
