# KOBA influencer promo and referrals

Phase 14I adds Influencer-mode referral codes, shop-configured payout terms,
order attribution, and test-mode Stripe Connect transfers.

Native ads / KCU placements remain deferred.

Campaign referrals, promo codes, deferred commissions, and contextual sponsored
ads are documented in [`docs/promotions.md`](promotions.md). This file covers
the original HANDLE-PRODUCT path, which still works.

## Roles

- Only the **active Influencer KOBAID** can create, revoke, or view own codes and
  earnings.
- Player accounts cannot configure promo codes.
- Business shop owners set **whether** influencers may promote their catalog and
  the payout formula. Influencers cannot set shop terms.
- Staff may inspect earnings status. They never receive Stripe secrets or
  Connect dashboard credentials.

## Referral codes

Format: `{HANDLE}-{PRODUCTSLUG}` uppercased (non-alphanumeric handle characters
removed). Example: `max-builds` + `oil-rig-kit` → `MAXBUILDS-OIL-RIG-KIT`.

- Unique per influencer + product.
- Creating the same pair again is idempotent (returns the existing active code
  or restores a revoked one).
- Share URL: `/r/{CODE}` sets an HttpOnly `koba_ref` cookie and redirects to the
  product. Clicks increment `clickCount` only (no IP/UA storage).
- Public catalog: `/promo/{handle}`.

## Checkout attribution

Checkout reads `referralCode` from the JSON body or the `koba_ref` cookie.

A code is ignored (purchase still proceeds) when:

- The code is unknown, revoked, or for a different product
- The shop has not enabled influencer promos
- The buyer is the influencer
- The influencer owns or belongs to the shop

Attributed orders store `referralCodeId` and `influencerShareCents`.

## Money

1. Platform commission is computed as today (8% / 4% verified).
2. Influencer share is then taken **from the seller remainder**, never from the
   platform fee, and never below zero.
3. Percent terms are basis points of **order total**, capped by
   `KOBA_INFLUENCER_MAX_BPS` (default 2500) and by seller remainder.
4. The influencer cut is added to `application_fee_amount` so Stripe holds it on
   the platform; the shop destination charge is reduced by the same amount.

`applicationFeeCents + sellerPayoutCents = totalCents` remains true.

## Payouts

Influencers onboard **Express transfers** (test mode only). After `ORDER_PAID`:

- Accrue an `InfluencerEarning`
- If payouts are enabled, transfer with idempotency key `inf-earn:{earningId}`
- Otherwise leave `PAYABLE` for `pnpm influencer:payouts`

Refunds:

- `ACCRUED` / `PAYABLE` → `VOID`
- `PAID` → `HELD` (no automatic Stripe transfer reversal in this phase)

## Tagging

Influencers follow the shop `taggingAllowed` flag. They cannot override a shop
opt-out. Contextual sponsored placements are documented in
[`docs/promotions.md`](promotions.md).

## Worker

```bash
pnpm influencer:payouts
```

PostgreSQL is the queue (status scan). Redis is not required.

## Adding another promo surface

1. Keep shop-owned payout terms.
2. Reuse `resolveReferralForCheckout` rather than a second attribution path.
3. Do not accept arbitrary payout destinations from the influencer.
