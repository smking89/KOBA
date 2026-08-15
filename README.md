# KOBA

Infinite-scrolling social marketplace for game-server communities — trade skins,
maps, monuments, and cosmetics; follow shops and creators; find groups and
squads; all on one KOBAID.

## Status

**Phase 15 — Live KOBA Coin purchases** is done (Stripe Checkout against a
fixed Coin package catalog, credited via the double-entry ledger on signed
webhook). Item trading (Phase 14C) is also merged. Next: the influencer ads
network (deferred).

The HTML prototype remains the information-architecture reference:

[`design/ui-ux-design-system.html`](design/ui-ux-design-system.html)

Product visual identity for the app is **dark neon** (logo-inspired lime / mint
gradient on black). The prototype documents screens and flows; production tokens
live in `app/globals.css` and `lib/design-tokens.ts`.

### Owner expansion routes (UI foundations)

| Path                                                  | Purpose                                   |
| ----------------------------------------------------- | ----------------------------------------- |
| `/trade`, `/trade/[tradeId]`                          | Trade discovery, composer, history (mock) |
| `/servers`, `/servers/[serverId]`, `/servers/connect` | Server directory + RCON connect wizard    |
| `/plus`                                               | KOBA Plus plans and subscription states   |
| `/aiden`, `/aiden/generate`, `/aiden/library`         | Aiden creator, jobs, asset library        |
| `/wallet`                                             | KOBA Coins wallet (ledger-backed)         |

See [docs/wallet-ledger.md](docs/wallet-ledger.md) for the Phase 14B accounting model.
Coins can be bought for real money at `/wallet` (Stripe Checkout, test mode —
see the Payments section below). Live AI capture and cash withdrawal remain
deferred.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript (strict)
- Tailwind CSS v4 · shadcn-style primitives
- Zod · Zustand (UI chrome only)
- Vitest · Playwright · ESLint · Prettier
- Docker Compose PostgreSQL · Prisma · Auth.js (Phase 3)
- GitHub Actions CI
- Vercel-compatible

## Quick start

### Requirements

- Node.js 20+
- pnpm 9+
- Docker (optional, for local Postgres)

### Install

```bash
pnpm install
cp .env.example .env.local
# Generate AUTH_SECRET: openssl rand -base64 32
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local database

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

Default URL (also in `.env.example`):

`postgresql://koba:koba@localhost:5432/koba?schema=public`

Required env for auth (add to `.env.local`):

- `DATABASE_URL` — Postgres connection string
- `AUTH_SECRET` — at least 32 random characters (`openssl rand -base64 32`)
- `AUTH_URL` — usually `http://localhost:3000`

### Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

End-to-end (starts the dev server via Playwright config):

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

### PWA (Phase 2)

Generate or refresh install icons:

```bash
pnpm icons:generate
```

Production build bundles the service worker (`public/sw.js`). Install and update
prompts appear in production mode:

```bash
pnpm build && pnpm start
```

Verify manifest at `/manifest.webmanifest` and offline fallback at `/offline`.
Sensitive API paths are excluded from service-worker caching by design.

### Authentication (Phase 3)

Routes:

| Path               | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `/register`        | Create account (Player / Business / Influencer) |
| `/verify-email`    | Confirm email (link from mailer)                |
| `/login`           | Credentials sign-in                             |
| `/forgot-password` | Request reset link                              |
| `/reset-password`  | Set new password                                |
| `/kobaid`          | Immutable KOBAID reveal                         |
| `/dashboard`       | Player dashboard                                |
| `/business`        | Business dashboard                              |
| `/influencer`      | Influencer dashboard                            |
| `/settings`        | Mode switch + identities                        |

In development, verification and reset links are logged to the terminal
(`lib/email/dev-mailer.ts`) instead of sending real email.

Flow: register (pick a public account type) → verify email (server mints KOBAID) →
login → reveal screen → type dashboard. Add extra public types from Settings.
Staff roles (SA/AD/MD) are issued only via `POST /api/admin/kobaid`.

### KOBAID (Phase 4)

Format `KOBA-{PL|BZ|IN|SA|AD|MD}-XXXX` where `XXXX` is 4 uppercase hex characters
from `crypto.randomBytes`. Codes are unique, immutable, and never chosen by the
user. Collisions retry up to 32 times, then fail closed.

Public minting accepts Player, Business, and Influencer only. Superadmin may
issue SA/AD/MD; Admin may issue MD. Group Admin/Moderator badges remain
community roles, not staff.

### Marketplace (Phase 5)

Public catalog at `/market` and `/market/[slug]`. Listings are visible only when
`moderationStatus` is `APPROVED` and `publishedAt` is set.

Filters: `q`, `game`, `category`, `rarity`, `platform`, `listing`, `sort`, `page`.
Signed-in users can save listings (`POST /api/market/favorites`). Buy-now listings
check out through Stripe (test mode). Live auctions accept bids, then the winner
pays the reserved amount.

### Shops (Phase 6)

Public shop profiles at `/shops/[slug]`. A Business KOBAID may own one shop.
Shop Owner and Shop Moderator are community roles on the shop, not KOBA staff
(SA/AD/MD).

Listings start as `DRAFT`. Sellers submit to `PENDING`. Only KOBA staff can
approve (`POST /api/admin/products/[slug]/approve`) and set `publishedAt`.
Sellers cannot self-approve. Editing a live listing returns it to pending.

Staff (SA/AD) verify shops at `POST /api/admin/shops/[slug]/verify`. Follows and
reviews require a signed-in user who is not the shop owner.

Business dashboard analytics count live listings, drafts, followers, reviews,
inventory, orders, and a live-computed rarity distribution across the shop's
catalog (no rollup job — recomputed on every dashboard read).

Connect payouts at `/business/payouts` before buyers can check out.

**Cosmetics** are a separate, closed-catalog track from `Product`: avatar
decorations, profile effects, and nameplates, sold pre-made with no
custom-build fields. Each cosmetic belongs to a shop (`ownerShopId`, a real
FK). Sellers create/update drafts via `POST`/`PATCH /api/business/cosmetics`;
the public catalog reads only `APPROVED` cosmetics via `GET /api/market/cosmetics`
and `GET /api/market/cosmetics/[slug]`.

**Promo settings** (`ShopPromoConfig`) let a shop opt into influencer
eligibility and set payout terms — percent (basis points, 0–10000) or fixed
(cents) — via `GET`/`PATCH /api/business/promo`. This is the shop-side half of
a future influencer payout system; nothing reads these terms yet.

### Auctions (Phase 7)

Auction listings expose a live clock, current bid, minimum increment, and bid
history on `/market/[slug]`. `POST /api/auctions/[slug]/bids` is transactional
(`SELECT … FOR UPDATE` plus serializable isolation, retried on conflict).
Sellers and shop members cannot bid on their own listings. Bids in the last two
minutes extend the clock by two minutes.

When time expires the highest bid is reserved for checkout. The winner pays via
Stripe Checkout (`Pay now` on the listing). No charge is taken at bid time.
Updates stream over `GET /api/auctions/[slug]/stream` (SSE).
Idempotency keys prevent duplicate submissions. Bid APIs are never cached by the
service worker.

### Payments (Phase 8)

Stripe Connect **test mode** only. Platform fee of
**8%** unverified / **4%** Blue-Badge verified
(`KOBA_COMMISSION_BPS` default 800, `KOBA_COMMISSION_BPS_VERIFIED` default 400,
cap 2500). Hosted Checkout is the
payment UI. **Paid status comes only from signed webhooks** — the browser cannot
mark an order paid (`?checkout=success` is ignored).

Checkout charges settle to **KOBA's own Stripe balance** — no
`transfer_data`/`application_fee_amount` on the PaymentIntent, so nothing moves
to the seller's Connect account at charge time. See Escrow below for how and
when the seller actually gets paid.

| Path                                           | Purpose                                   |
| ---------------------------------------------- | ----------------------------------------- |
| `POST /api/checkout`                           | Create a Checkout Session (idempotent)    |
| `POST /api/stripe/webhook`                     | Signed Stripe events                      |
| `GET`/`POST /api/business/connect`             | Express onboarding                        |
| `POST /api/business/orders/[ref]/fulfill`      | Shop owner fulfill                        |
| `POST /api/business/orders/[ref]/refund`       | Shop owner refund                         |
| `POST /api/admin/orders/[ref]/refund`          | Staff (SA/AD) refund                      |
| `POST /api/orders/[ref]/dispute`               | Buyer flags an escrow dispute             |
| `POST /api/admin/orders/[ref]/resolve-dispute` | Staff (SA/AD) release or refund a dispute |
| `/orders` · `/orders/[ref]`                    | Buyer history and receipts                |
| `/business/payouts`                            | Connect charges/payouts status            |

Sellers and shop members cannot buy their own listings. Auction checkout requires
`RESERVED`, the winning bidder, and a future `reservedUntil`. Inventory decrements
when checkout starts and restores if the session expires or the order is refunded.
Refunds after escrow has released reverse the Connect transfer; refunds before
release (escrow still `HOLDING`/`DISPUTED`) skip `reverse_transfer` because no
transfer to the seller ever happened.

Placeholder Stripe keys (`sk_test_replace_me`) fail closed — checkout returns 503
instead of faking paid. Forward webhooks locally with:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

#### Escrow (order holds and disputes)

Digital goods deliver instantly, so a bad-faith seller or "not as described"
item previously had zero recourse — the seller's payout used to transfer the
instant the buyer paid. Now the seller's payout sits on KOBA's own Stripe
balance in an `OrderEscrow` row (`HOLDING → RELEASED`) for a short hold window
(`KOBA_ESCROW_HOLD_DAYS`, default 3 days, cap 30) after `markOrderPaid`, then
auto-releases via `escrow.service.ts`'s `releaseEscrow` — a real
`stripe.transfers.create` to the seller's Connect account.

The buyer can flag a dispute any time before release
(`POST /api/orders/[ref]/dispute`), which freezes the timer (`DISPUTED`).
Staff (SA/AD) resolve manually (`POST /api/admin/orders/[ref]/resolve-dispute`)
by releasing to the seller or refunding the buyer — no arbitration workflow or
evidence upload. `Order.status` is untouched by any of this; escrow state
lives entirely in the sibling `OrderEscrow` table.

There is no cron here. `sweepExpiredEscrowHolds` (all `HOLDING` rows past
`releaseAt`) is built to be invoked by a future scheduler or manually — same
deferred-scheduler pattern used elsewhere in this codebase.

### Groups and LFG (Phase 9)

Public and private groups at `/groups` and `/groups/[slug]`. Anyone with a KOBAID
can create a group. **Group Owner / Admin / Moderator are community roles**, not
KOBA staff (SA/AD/MD).

Public groups join immediately. Private groups need a request or an invite by
KOBAID. Moderators can approve requests, kick, and ban. Admins can invite and
assign Moderator/Member. The owner can assign Admin.

LFG at `/lfg` filters by game, platform, region, skill, mic, and availability.
Posts expire; authors accept requests until the roster is full. Self-join is
blocked. Group feeds are live on each group page.

| Path                               | Purpose                           |
| ---------------------------------- | --------------------------------- |
| `POST /api/groups`                 | Create a group                    |
| `POST /api/groups/[slug]/join`     | Join public or request private    |
| `POST /api/groups/[slug]/leave`    | Leave (owner cannot)              |
| `POST /api/groups/[slug]/moderate` | Invite, approve, kick, ban, roles |
| `POST /api/lfg`                    | Create an LFG post                |
| `POST /api/lfg/[ref]/join`         | Request a seat                    |
| `POST /api/lfg/[ref]/moderate`     | Accept, deny, or cancel           |

Seeded examples: `/groups/rust-legacy-raiders` and `KOBA-LFG-WIPE0001`.

### Social (Phase 10)

Public profiles at `/u/[handle]`. Follows and blocks are user-to-user (shop follows
stay separate). Blocking removes both follow directions and blocks tagging,
comments, and feed visibility.

Posts use `KOBA-PST-` public refs. Visibility is public or followers-only.
Mentions (`@handle`) and explicit shop/group/product tags respect tag privacy
(`EVERYONE` / `FOLLOWERS` / `NO_ONE`), shop `taggingAllowed`, and group
`taggingAllowed`. Blocked accounts can never tag. Stories expire after 24 hours
(`KOBA-STY-`). Reports (`KOBA-RPT-`) go to staff. KOBA staff (SA/AD/MD) can hide
posts — group Owner/Admin/Moderator cannot. Sponsored is a boolean hook with a
“Sponsored” label; full ads land in Phase 12.

Signed-in feed is self plus following. Signed-out feed is public live posts.
Pagination is `page` / `pageSize` (default 8).

| Path                                    | Purpose                      |
| --------------------------------------- | ---------------------------- |
| `GET /api/social/feed`                  | Paginated home or group feed |
| `POST /api/social/posts`                | Create a post                |
| `POST /api/social/posts/[ref]/like`     | Toggle like                  |
| `POST /api/social/posts/[ref]/save`     | Toggle save                  |
| `POST /api/social/posts/[ref]/comments` | Add a comment                |
| `POST /api/social/stories`              | Create a 24h story           |
| `POST /api/social/follow/[handle]`      | Toggle follow                |
| `POST /api/social/block/[handle]`       | Toggle block                 |
| `POST /api/social/report`               | File a content report        |
| `POST /api/social/settings`             | Tag privacy and bio          |
| `POST /api/groups/[slug]/tagging`       | Owner tagging toggle         |
| `POST /api/business/tagging`            | Shop tagging toggle          |
| `POST /api/admin/posts/[ref]/hide`      | Staff hide                   |

Seeded examples: `/u/maxbuilds`, `/u/ironwright`, `KOBA-PST-FEED0001`,
`KOBA-STY-WIPE0001`.

### Direct messaging (Phase 11)

Private 1:1 conversations at `/messages` and `/messages/[ref]`. Blocked accounts
cannot open or continue a chat. Read state, typing signals, and live updates use
SSE. Voice notes and attachments accept **https URLs only** in this phase (no
binary upload yet). Call buttons are UI stubs.

**Vanish mode** marks new messages as vanish and purges them when a participant
leaves the thread (`pagehide` or explicit leave). Vanish cannot prevent
screenshots, screen recordings, notification previews, or copies made before
purge — do not advertise otherwise.

| Path                              | Purpose                     |
| --------------------------------- | --------------------------- |
| `GET /api/messages`               | Inbox                       |
| `POST /api/messages`              | Open/create chat by handle  |
| `GET /api/messages/[ref]`         | Thread snapshot             |
| `POST /api/messages/[ref]`        | Send message                |
| `GET /api/messages/[ref]/stream`  | Live SSE updates            |
| `POST /api/messages/[ref]/read`   | Mark read                   |
| `POST /api/messages/[ref]/typing` | Typing signal               |
| `POST /api/messages/[ref]/vanish` | Toggle vanish mode          |
| `POST /api/messages/[ref]/leave`  | Purge vanish messages       |
| `POST /api/messages/[ref]/report` | Report conversation/message |

Seeded example: `KOBA-DM-WIPE0001` between maxbuilds and ironwright.

### Staff admin (Phase 12)

Staff console at `/admin` for Superadmin / Admin / Moderator KOBAIDs. Queues cover
pending listings, pending shop verification, and open content reports. Staff can
approve or reject listings, verify or reject shops (SA/AD), resolve reports (and
hide posts), issue staff KOBAIDs, and refund orders by public ref (SA/AD).

| Path                                      | Purpose                            |
| ----------------------------------------- | ---------------------------------- |
| `GET /api/admin/overview`                 | Counts + recent audit              |
| `GET /api/admin/products/pending`         | Listing moderation queue           |
| `POST /api/admin/products/[slug]/approve` | Approve listing                    |
| `POST /api/admin/products/[slug]/reject`  | Reject listing                     |
| `GET /api/admin/shops/pending`            | Shop verification queue            |
| `POST /api/admin/shops/[slug]/verify`     | Verify or reject shop              |
| `GET /api/admin/reports`                  | Open content reports               |
| `POST /api/admin/reports/[ref]/resolve`   | Review / dismiss (+ optional hide) |
| `POST /api/admin/kobaid`                  | Issue staff KOBAID                 |
| `POST /api/admin/orders/[ref]/refund`     | Staff refund                       |
| `POST /api/admin/posts/[ref]/hide`        | Hide a live post                   |

Local seed staff: `staff@koba.local` / `KobaStaff1!` (SUPERADMIN). Queues include
`pending-oil-rig-kit`, shop `raid-ready-maps`, and report `KOBA-RPT-STAFF001`.

### Production readiness (Phase 13)

Ops hardening for a community launch (not ads / influencer / developer portal).

| Area        | Behavior                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Email       | Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set; otherwise terminal links in non-prod; **fails closed in production** |
| Rate limits | In-memory by default; Upstash Redis REST when `UPSTASH_REDIS_REST_*` is set                                               |
| Health      | `GET /api/health` (add `?deep=1` for a DB ping)                                                                           |
| Media       | `POST /api/media/presign` for S3/R2/MinIO; optional `MEDIA_ALLOWED_HOSTS` / `S3_PUBLIC_BASE_URL` allowlist                |
| Stripe      | Test mode only — `sk_live_` stays blocked; readiness notes via health checks                                              |

```bash
# Example health
curl -s http://localhost:3000/api/health
curl -s "http://localhost:3000/api/health?deep=1"
```

## Visual identity

| Token          | Value                                  |
| -------------- | -------------------------------------- |
| Background     | `#050505`                              |
| Surface        | `#0D0F0E` / `#141816`                  |
| Text           | `#F5FFF8` / muted `#98A69D`            |
| Neon lime      | `#B8FF00`                              |
| Electric green | `#35FF52`                              |
| Neon mint      | `#00F5A0`                              |
| Brand gradient | `135deg · #C6FF00 → #55FF35 → #00F5A0` |

Use CSS theme tokens (`bg-background`, `text-neon-lime`, `bg-brand-gradient`) —
do not scatter raw hex in feature components.

Official mark: `public/brand/koba-logo.png` (used by `BrandMark`). Refresh install
icons with `pnpm icons:generate` (writes `public/icons/*` and `apple-touch-icon.png`
from that asset). Favicon: `app/icon.png`.

## KOBAID (product rules)

| Format    | Role               |
| --------- | ------------------ |
| `KOBA-PL` | Player             |
| `KOBA-BZ` | Business           |
| `KOBA-IN` | Influencer         |
| `KOBA-SA` | Superadmin (staff) |
| `KOBA-AD` | Admin (staff)      |
| `KOBA-MD` | Moderator (staff)  |

Server-minted, cryptographically random, unique, immutable. Staff IDs are never
self-registered. Group Admin/Moderator badges are community roles, not staff.

## Build plan

1. ~~UI / GUI / UX design prototype~~ ✅
2. ~~Application foundation~~ ✅
3. **PWA foundation** ✅
4. ~~Database + Auth.js~~ ✅
5. ~~Account types + KOBAID~~ ✅
6. **Marketplace** ✅
7. **Shops** ✅
8. **Auctions** ✅
9. **Payments** ✅
10. **Groups / LFG** ✅
11. **Social** ✅
12. **Direct messaging** ✅
13. **Staff admin** ✅
14. **Production readiness** ✅
15. **Brand icons (official logo)** ✅
16. **Fee tiers (8% / 4% verified)** ✅
17. **Owner product expansion UI** ✅
18. **Owner expansion backends** ✅
19. **KOBA Coins double-entry ledger** ✅
20. **Player-to-player item trading** ✅
21. **Live KOBA Coin purchases** ✅ ← current
22. Influencer ads network (deferred)

## License

All rights reserved — see [LICENSE](LICENSE).
