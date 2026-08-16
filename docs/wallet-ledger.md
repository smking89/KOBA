# KOBA Coins — double-entry ledger

Phase 14B financial foundation for KOBA Coins.

## Architecture

Every completed Coin movement is a **LedgerTransaction** with two or more
**LedgerEntry** rows. Invariant:

```text
sum(debits) = sum(credits)
```

Amounts are integer **Coin units** stored as PostgreSQL `BIGINT` / Prisma `BigInt`.
JavaScript `number` floats are rejected at the parse boundary.

The immutable ledger is the source of truth. `CoinWallet.*Balance` columns are
**projections** updated in the same database transaction and rebuildable via
`reconcileWallet`.

## Account types

| Kind                                                                    | Role                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `USER_PURCHASED` / `USER_PROMOTIONAL` / `USER_EARNED` / `USER_RESERVED` | Per-user asset buckets                                                   |
| `PLATFORM_TREASURY`                                                     | Platform float                                                           |
| `PLATFORM_PROMO_ISSUANCE`                                               | Contra for promotional grants                                            |
| `PLATFORM_REVENUE`                                                      | Captured spend / commissions                                             |
| `REFUND_CLEARING`                                                       | Reserved for refund settlement                                           |
| `EXTERNAL`                                                              | Off-platform settlement — the contra side of a real Stripe Coin purchase |

## Balance classifications

| Field         | Meaning                                  |
| ------------- | ---------------------------------------- |
| `purchased`   | Coins credited from (future) paid packs  |
| `promotional` | Grants / rewards — not cash-withdrawable |
| `earned`      | Seller / creator earnings in Coins       |
| `reserved`    | Held by active reservations              |
| `available`   | purchased + promotional + earned         |
| `total`       | available + reserved                     |

## Spending order

Default (configurable via `resolveSpendOrder` / `allocateSpend`):

1. Promotional
2. Purchased
3. Earned

Promotional Coins are not assumed refundable for cash.

## Reservation lifecycle

`PENDING → ACTIVE → CAPTURED | RELEASED | EXPIRED | CANCELLED`

- **Reserve** — allocate from available buckets into `RESERVED`, create `CoinReservation`.
- **Capture** — once; move reserved amount to platform revenue.
- **Release** — once; restore original bucket allocations.
- **Expire** — server `expireReservations()` releases expired ACTIVE rows (idempotent).

## Idempotency

`LedgerTransaction.idempotencyKey` and `CoinReservation.idempotencyKey` are unique.
Safe retries return the original posted result without double-applying projections.

## Reversals

Posted entries are never edited or deleted. Corrections create a **REVERSAL**
transaction that mirrors entries and links via `reversesTxId` / `reversedByTxId`.

## Concurrency

Interactive Prisma transactions lock the wallet row:

```sql
SELECT id FROM "CoinWallet" WHERE "userId" = $1 FOR UPDATE
```

This serialises reservations, captures, releases, and grants per wallet.

## Security boundaries

- No public mint endpoint.
- Clients cannot choose ledger accounts.
- Wallet APIs require auth, rate limits, and `Cache-Control: no-store`.
- `/api/wallet` is on the Serwist never-cache list.
- Staff adjustments require staff account types and a written reason.
- Cross-wallet access is rejected.

## Coin purchases (live)

`CoinPurchase` (separate table from `Order` — no shop, no escrow, no seller
payout: KOBA is the seller and the charge settles to and stays on KOBA's own
Stripe balance) tracks a real-money Stripe Checkout Session against one of a
fixed set of Coin packages (`features/wallet/lib/coin-packages.ts` —
hardcoded catalog, a known simplification; a real admin-managed pricing table
is future work). Same trust model as marketplace checkout: the browser can
never mark a purchase paid — only a signed `checkout.session.completed`
webhook, routed by `session.metadata.kind === "coin_purchase"`, calls
`markCoinPurchasePaid`, which credits the buyer's `PURCHASED` bucket via
`creditPurchasedCoins` using `CoinPurchase.idempotencyKey` as the ledger's
own idempotency key — a retried webhook can never double-credit.

## Deferred

- Cash withdrawal
- Real Aiden AI capture path (today reserves then releases on stub failure)
- Admin-configurable Coin package pricing (currently a fixed hardcoded catalog)
