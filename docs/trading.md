# Player-to-player trading

Phase 14C — secure item trading with ownership locks.

## Ownership model

Marketplace `Product` is a listing, **not** proof of ownership.

`InventoryItem` is the owned transferable asset:

- `ownerUserId` — current owner
- `transferable` — must be true to trade
- `listedForTrade` — visible in public discovery
- `status` — `ACTIVE` | `TRADE_LOCKED` | `AUCTION_LOCKED` | …
- `lockTradeOfferId` — which pending trade holds the lock

## Rarity policy

Every item on both sides of a trade must share **one** rarity tier
(`assertSameRarityTrade`). Equal rarity does **not** mean equal value.

Warning shown in UI:

> Items in the same rarity tier may still have different market values. Review every item before accepting.

## State machine

```text
DRAFT → PENDING
PENDING → ACCEPTED | REJECTED | CANCELLED | COUNTERED | EXPIRED | VOIDED
COUNTERED → ACCEPTED | REJECTED | CANCELLED | COUNTERED | EXPIRED | VOIDED
ACCEPTED → COMPLETED | VOIDED
COMPLETED → DISPUTED
```

Browser cannot set arbitrary statuses. Transitions go through server actions.

## Item locking

On create (PENDING):

1. Validate ownership, transferability, ACTIVE, unlocked
2. Set `TRADE_LOCKED` + `lockTradeOfferId`

On reject / cancel / expire / void: clear locks → `ACTIVE`

On complete: transfer `ownerUserId`, clear locks → `ACTIVE`

## Atomic acceptance

Single PostgreSQL transaction:

1. `SELECT … FOR UPDATE` trade
2. Lock inventory rows `ORDER BY id ASC`
3. Revalidate ownership, locks, rarity, expiry, actor
4. Optional Coin fee via ledger (default fee = 0)
5. Transfer all items or roll back

## Counteroffers

Create a **child** trade referencing `parentTradeId`. Parent becomes `COUNTERED`
and its locks are released before the child acquires new locks.

## Expiration

`expireTrades()` is idempotent for cron/VPS workers. Do not rely on the browser.

## Fees

`resolveTradeFee()` defaults to **zero**. When enabled, acceptance uses the
KOBA Coins ledger (reserve → capture) with idempotency keys.

## Caching

`/api/trade` and `/api/inventory` are never cached by the service worker.
Responses use `Cache-Control: no-store`.
