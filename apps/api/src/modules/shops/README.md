# shops

**Phase:** Phase 4
**Status:** implemented (service/DI layer, no HTTP routes yet — same
posture as Phase 1's kobaid module and Phase 3's marketplace module)

Shop profile, analytics, product management, followers, tagging
permission (flag only), promo settings, and a structural-only Stripe
Connect onboarding wrapper. Business info/identity (KYC) still lives
entirely in Stripe — no government-ID or business-legal-name field
exists anywhere in this module, by hard constraint (ROADMAP.md Phase 4).

## What's here

- `shop.types.ts` — `Shop` (id/ownerKobaId/createdAt immutable once
  created — no update path for them anywhere in this module — but
  name/bio/bannerUrl/avatarUrl ARE editable, unlike `KobaId`'s full
  immutability), `CreateShopParams`/`UpdateShopProfileParams`,
  `PromoPayoutConfig` (discriminated union: `{ kind: 'percent', percent }`
  or `{ kind: 'fixed', fixedCents }` — never both, never neither, see
  `ShopPromoService`), `ShopAnalytics`.
- `shop.errors.ts` — typed domain errors (`ShopDomainError` base class,
  same pattern as `kobaid/kobaid.errors.ts` /
  `marketplace/marketplace.errors.ts`): `InvalidShopOwnerKobaIdFormatError`,
  `ShopOwnerMustBeBusinessRoleError`, `ShopNotFoundError`,
  `ShopNotOwnedByCallerError`, `ProductNotPartOfShopError`,
  `InvalidPromoPayoutConfigError`, `InvalidShopStripeStatusTransitionError`.
- `shop.repository.ts` / `in-memory-shop.repository.ts`,
  `shop-follower.repository.ts` / `in-memory-shop-follower.repository.ts` —
  interface-behind-in-memory-implementation, same pattern and storage
  decision as `kobaid/kobaid.repository.ts` (see "Storage decision"
  below).
- `shop-authorization.util.ts` — `assertShopOwner(shop, callerKobaId)`,
  the shared "only the shop's owner may do this" guard used by every
  service below that gates a mutation to `Shop.ownerKobaId`.
- `shop.service.ts` — `ShopService`:
  - `createShop()` — validates `ownerKobaId` is a Business-role (`BZ`)
    KOBAID by parsing its KOBA-ROLE-CODE format/role encoding (via
    `kobaid/kobaid-format.ts`'s `KOBA_ID_PATTERN`) — a Player or
    Influencer KOBAID cannot own a Shop
    (`ShopOwnerMustBeBusinessRoleError`). Same posture as marketplace's
    `sellerId`/`sellerKobaId` fields — a plain KOBAID string, not a
    required-to-exist foreign-key lookup this phase.
  - `getById()` / `findById()`.
  - `updateProfile()` — editable fields only (name/bio/banner/avatar);
    owner-only (`ShopNotOwnedByCallerError` otherwise).
  - `setAllowTagging()` / `isTaggingAllowed()` — owner-controlled
    tag-permission flag, defaults `true`. This is Phase 6's shop-level
    analogue to `accounts/tagging-permission.service.ts`'s role-level
    rules — flag + query only, **no tag enforcement anywhere in this
    module** (that's Phase 6).
- `shop-promo.service.ts` — `ShopPromoService#setPromoSettings()` /
  `#getPromoSettings()`: `promoEligible` boolean plus a payout-rate
  config, exactly one of `percent` (0-100) or `fixedCents` (non-negative
  integer) — both set or neither set throws
  `InvalidPromoPayoutConfigError`. Config only — actual referral-code
  generation and payout execution is Phase 10 (Influencer System),
  explicitly out of scope here; Phase 10 is expected to *read* these
  settings.
- `shop-analytics.service.ts` — `ShopAnalyticsService#getAnalytics()`: a
  read-model computed from existing marketplace data, not a separate
  precomputed rollup table this phase (ROADMAP.md's
  `ShopAnalyticsSnapshot` concept is not implemented — see "Explicitly
  out of scope" below). Returns total revenue (sum of settled Order
  `amountCents` where `sellerKobaId` belongs to this shop — every `Order`
  row in marketplace already represents a settled purchase, see
  marketplace/README.md), order count, follower count, and rarity
  distribution (count per `RarityTier`, matching the Phase 0 design's
  "Rarity distribution" bar on the Shop Page screen). Reads through
  marketplace's `ProductService#listByShopId()` and
  `OrderService#listBySellerKobaId()` (both additive — see "What changed
  in marketplace/" below) rather than re-implementing storage.
- `shop-product.service.ts` — `ShopProductService`: a thin wrapper around
  marketplace's existing `ProductService`.
  - `createProduct()` — only the shop's owner may create a product
    "through" the shop (`ShopNotOwnedByCallerError` otherwise); every
    product created this way gets `Product.shopId` set and
    `Product.sellerId` set to the shop's `ownerKobaId`. Blocked unless
    the shop's Stripe Connect status is `active`
    (`StripeAccountNotActiveError`, reusing marketplace's existing
    `StripeConnectService#assertSellerCanReceivePayouts()` gate rather
    than reimplementing it).
  - `setDelisted()` — owner-only, and only for a product actually
    attributed to this shop (`ProductNotPartOfShopError` otherwise);
    delegates to `ProductService#setDelisted()`.
  - `listProducts()` — all of a shop's products, optionally filtered by
    `cosmeticType` (the existing marketplace `CosmeticType` enum —
    avatarDecoration | profileEffect | nameplate). No new modeling:
    `Product` already carries `category`/`cosmeticType` from Phase 3;
    this is just a query parameter on the listing method.
- `shop-follow.service.ts` — `ShopFollowService#follow()` /
  `#unfollow()` / `#isFollowing()` / `#countFollowers()`: `follow()` is
  idempotent (following twice never creates a second record or errors —
  see `InMemoryShopFollowerRepository`'s `Set`-based storage),
  `unfollow()` is idempotent too (removing a follow you don't have is a
  no-op, not an error). Follower count feeds `ShopAnalyticsService`.
- `shop-stripe-connect.service.ts` — `ShopStripeConnectService`: a
  shop-level wrapper around marketplace's existing (structural-only, no
  real Stripe API calls) `StripeConnectService`, keyed by
  `Shop.ownerKobaId`. `initiateConnection()` transitions
  `notConnected -> pending`, `confirmConnection()` transitions
  `pending -> active` — both pure state transitions, both owner-only,
  both reject an invalid transition
  (`InvalidShopStripeStatusTransitionError`). Reuses marketplace's
  existing per-seller status + order-time gating
  (`assertSellerCanReceivePayouts()`) rather than reimplementing a
  parallel state machine — a shop cannot sell (create products, per
  `ShopProductService#createProduct()`; or receive orders, per
  marketplace's own `OrderService`) while its Stripe status isn't
  `active`.
- `shops.module.ts` — Nest module wiring every service above behind
  their repository DI tokens, importing `MarketplaceModule` (cross-module
  DI via service injection — `ProductService`/`OrderService`/
  `StripeConnectService` — same pattern `accounts/accounts.module.ts`
  uses importing `KobaidModule` and injecting `KobaidService`, not raw
  repository tokens). **Not yet imported by `AppModule`** — same posture
  as `marketplace.module.ts`; wiring it in is a follow-up task.

## What changed in `marketplace/` (small, additive only)

Per this module's task scope, `marketplace/` was touched only for the
minimum shape shops genuinely needs, reusing marketplace's existing
services rather than reimplementing them:

- `marketplace.types.ts` — added `Product.shopId: string | null` (and
  `CreateProductParams.shopId?`) so a product created "through" a shop
  carries a pointer back to it. Optional, defaults to `null` for products
  listed directly with no shop attribution — this module does not
  validate the `shopId` against a real `Shop` record; that's this
  module's job (`ShopProductService`).
- `product.repository.ts` / `in-memory-product.repository.ts` — added
  `findByShopId(shopId)`.
- `product.service.ts` — added `listByShopId(shopId)`, a thin wrapper
  over the above, used by `ShopAnalyticsService` and
  `ShopProductService#listProducts()`.
- `order.repository.ts` / `in-memory-order.repository.ts` — added
  `findBySellerKobaId(sellerKobaId)`.
- `order.service.ts` — added `listBySellerKobaId(sellerKobaId)`, a thin
  wrapper over the above, used by `ShopAnalyticsService` for the revenue/
  order-count computation (a shop's orders are always keyed by
  `Order.sellerKobaId === Shop.ownerKobaId`, since every shop product's
  `sellerId` is set to the shop owner's KOBAID).

No other marketplace file was touched. No existing marketplace behavior
changed — `shopId` is optional everywhere it was added, and every
existing marketplace test (51 of them) still passes unmodified.

## Storage decision: in-memory repositories, not Prisma, this phase

Same rationale and pattern as `kobaid/kobaid.repository.ts` and
`marketplace/product.repository.ts` — see those modules' READMEs.
`ShopRepository` and `ShopFollowerRepository` are interfaces;
`InMemoryShopRepository` / `InMemoryShopFollowerRepository` are the only
implementations wired up right now. `Shop` and `ShopFollower` Prisma
models (plus the additive `Product.shopId` column) were added to
`packages/database/prisma/schema.prisma` — additive only, validated with
`prisma validate` — so the target shape is locked in ahead of Phase 12.
`apps/api` still has no `@prisma/client` dependency or generated client;
wiring Prisma-backed repositories is a later-phase follow-up.

## Explicitly out of scope this phase (left for later)

- **File upload for banner/avatar** — `bannerUrl`/`avatarUrl` are plain
  string fields (expected to hold a URL once uploaded elsewhere); no
  actual file upload/object-storage integration exists in this module.
- **Real Stripe API integration** — same non-goal as
  `marketplace/stripe-connect.service.ts`: no `stripe` SDK dependency, no
  real Connect account-link flow, no webhook handling.
  `ShopStripeConnectService#initiateConnection()`/`#confirmConnection()`
  are pure state transitions on top of marketplace's structural-only
  model.
- **Real tag enforcement (Phase 6)** — `Shop.allowTagging` is a flag +
  query method only (`ShopService#setAllowTagging()` /
  `#isTaggingAllowed()`); nothing in this module (or anywhere in the
  codebase yet) actually enforces it against a real `TagAction`/@mention
  model. That's Phase 6's job.
- **Referral code generation / payout execution (Phase 10)** —
  `ShopPromoService` only stores `promoEligible` + the payout-rate config
  (`PromoPayoutConfig`). No referral code is ever generated here, and no
  payout is ever computed/executed here; Phase 10 (Influencer System) is
  expected to read these settings when it lands.
- **`ShopAnalyticsSnapshot` precomputed rollups** — ROADMAP.md's Phase 4
  data-model sketch describes a periodic snapshot table (`views`, `sales`,
  `conversion`). This phase's `ShopAnalyticsService#getAnalytics()` is a
  live read-model computed on every call from marketplace's existing
  repositories instead — no background rollup job, no `views`/click
  tracking (nothing in the codebase tracks shop-page views at all yet).
  Precomputing/caching this is a follow-up once traffic volume justifies
  it.
- **Groups (Phase 5), real Social Layer tagging (Phase 6)** — not built
  here; only the shop-level `allowTagging` flag exists, per above.
- **HTTP controllers/routes** — same as kobaid/marketplace: Phase 13
  decides the route surface, gated by Phase 11's RBAC / Phase 1-2's
  capability flags.
