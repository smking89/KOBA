# KOBA influencer promotions and sponsored ads

This document covers Phase 14I campaign referrals, promo codes, commissions, and
internal sponsored placements. Legacy HANDLE-PRODUCT codes in
[`docs/influencer.md`](influencer.md) remain supported.

External bank payouts, tax reporting, and advanced fraud ML are **not**
implemented. Fiat influencer commissions stay deferred on KOBA.

## Attribution policy

Last eligible referral click wins.

Rules:

1. Campaign must be `ACTIVE` and inside its start/end window.
2. Participation must be `ACTIVE`.
3. Click (or assigned promo participation) must predate checkout.
4. Click must be inside the campaign attribution window (default 168 hours,
   `KOBA_ATTRIBUTION_WINDOW_HOURS`, or the campaign field).
5. Successful **paid** order is required before a commission is created.
6. Self-referral is rejected (buyer is the influencer).
7. Seller and influencer cannot be the same controlling account (shop owner or
   shop member).
8. One `PromotionCommission` per order (`orderId` unique).
9. If a campaign-assigned promo code is present **and** eligible, it overrides
   click attribution. Standalone promo codes discount only.
10. Duplicate click events share an idempotency bucket and never duplicate
    commissions.

Browser fingerprinting is not used.

## Cookies

`/r/kref_…` sets HttpOnly, SameSite=Lax, signed `koba_attr` (HMAC-SHA256 with
`AUTH_SECRET`). Payload is `token.expiry.signature`. Tampered or expired cookies
are ignored. Secure flag is on in production.

Legacy `/r/HANDLE-SLUG` still sets `koba_ref`.

Redirects are allowlisted: `/market`, `/shops`, `/apps`, `/servers` and nested
paths. Arbitrary external URLs are rejected.

## Promo codes

Sellers create campaign-bound or standalone codes. Codes are normalized to
`A-Z0-9-`. Validation is server-side against live product prices.

The order stores an immutable snapshot:

- original subtotal
- discount
- eligible commission base (`original - discount`)
- platform fee
- influencer commission
- seller proceeds
- currency
- campaign / promo / attribution source

Stacking is off unless `stackingAllowed` is true (MVP default false). Seller
self-use is rejected. Percentage discounts are floored integer basis points,
capped by `KOBA_MAX_DISCOUNT_BPS` (default 5000). Usage limits use
`updateMany` with `usageCount < usageLimit` so the last concurrent redemption
fails closed.

Paid snapshots are never edited when a campaign later changes.

## Commission lifecycle

`PENDING` → `QUALIFIED` → `AVAILABLE`

- Created only after authoritative `ORDER_PAID`.
- Hold: `KOBA_COMMISSION_HOLD_HOURS` (default 72).
- Worker marks `QUALIFIED` then `AVAILABLE`.
- Refund, chargeback (`charge.dispute.created`), or staff action → `REVERSED`
  and campaign budget is restored.
- `UNDER_REVIEW` for staff-flagged rows. Not auto-paid.
- `PAID` is reserved; this phase does **not** withdraw campaign commissions.

KOBA Coin marketplace orders are not mixed into fiat commission rows. Stripe
orders store integer minor units in the order currency.

Legacy HANDLE-PRODUCT earnings may still transfer in Stripe test mode via
`pnpm influencer:payouts`. Campaign commissions do not.

## Sponsored ads

Billing model: **COST_PER_CLICK** in KOBA Coins.

1. Staff approve the campaign.
2. Advertiser activates; total budget is reserved on the KOBA Coins ledger.
3. Selection is deterministic: active, in-window, remaining + daily budget,
   contextual match, frequency cap, then oldest `lastShownAt` / id.
4. Organic marketplace ranking is unchanged. Ads render in a separate
   **Sponsored** slot.
5. Clicks are idempotent per viewer+window. Advertiser self-clicks are recorded
   as suspicious and not billed. Obvious duplicates are not billed twice.
6. Spend never exceeds remaining or daily budget.
7. Cancel/complete settles the reservation: capture spent coins, release the
   rest.

Targeting may use only contextual fields: game, marketplace category, product
category, platform, broad region, placement. Prohibited: messages, sensitive
personal data, inferred ethnicity/religion/health/sexuality, precise location,
private profile data, minors’ behavioral profiles.

## Fraud thresholds

Configurable via env (defaults in parentheses):

- `KOBA_REFERRAL_CLICK_BURST` (20 / minute bucket)
- `KOBA_PROMO_GUESS_LIMIT` (10 / 15 min)
- `KOBA_CLICK_BURST_WINDOW_MS` (60000)
- `KOBA_AD_DUPLICATE_WINDOW_MS` (30000)
- `KOBA_CLICK_HASH_RETENTION_HOURS` (48)

Visitor network data is stored only as a short-lived HMAC (`visitorHash`) and
nulled after expiry. Raw IPs are not persisted on promotion tables.

## Privacy and retention

| Data                               | Retention                     |
| ---------------------------------- | ----------------------------- |
| Signed attribution cookie          | Attribution window            |
| `ReferralClickEvent.visitorHash`   | 48h default, then nulled      |
| Durable click/commission/ad events | Operational (reconciliation)  |
| Promotion notices                  | Until the account is deleted  |
| Public influencer stats            | Aggregates only (no balances) |

## Workers

```bash
pnpm promotions:worker   # qualify commissions, settle ads, expire hashes
pnpm influencer:payouts  # legacy test-mode Stripe transfers only
```

PostgreSQL is the queue. Redis is optional for rate limits only.

## Operational recovery

1. Duplicate Stripe webhooks are claimed in `ProcessedStripeEvent`.
2. Commission create uses `idempotencyKey = commission:{orderId}`.
3. If `ORDER_PAID` succeeded but commission insert failed, the next paid webhook
   retries `createCommissionForPaidOrder`.
4. Ad reservation settle is idempotent on `ad-settle:{campaignId}`.
5. Suspicious commissions stay `UNDER_REVIEW` until staff act.

Apply migration `20250815160000_influencer_promotions` before enabling the
worker.
