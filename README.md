# KOBA

Infinite-scrolling social marketplace for game-server communities — trade skins,
maps, monuments, and cosmetics; follow shops and creators; find groups and
squads; all on one KOBAID.

## Status

**Phase 7 — Auctions** is in progress on `feat/auctions`.

The HTML prototype remains the information-architecture reference:

[`design/ui-ux-design-system.html`](design/ui-ux-design-system.html)

Product visual identity for the app is **dark neon** (logo-inspired lime / mint
gradient on black). The prototype documents screens and flows; production tokens
live in `app/globals.css` and `lib/design-tokens.ts`.

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
Signed-in users can save listings (`POST /api/market/favorites`). Buy-now checkout
is Phase 8. Live auctions accept bids now.

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
and inventory. Order inbox is empty until checkout (Phase 8) — no estimated
revenue.

### Auctions (Phase 7)

Auction listings expose a live clock, current bid, minimum increment, and bid
history on `/market/[slug]`. `POST /api/auctions/[slug]/bids` is transactional
(`SELECT … FOR UPDATE` plus serializable isolation, retried on conflict).
Sellers and shop members cannot bid on their own listings. Bids in the last two
minutes extend the clock by two minutes.

When time expires the highest bid is reserved for checkout (Phase 8). No charge
is taken here. Updates stream over `GET /api/auctions/[slug]/stream` (SSE).
Idempotency keys prevent duplicate submissions. Bid APIs are never cached by the
service worker.

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

> Official logo assets are not in the repo yet. `BrandMark` is a temporary
> geometric placeholder for Phase 1–2 until the logo file is supplied.

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
8. **Auctions** ← current
9. Payments
10. Groups / LFG → social → DMs
11. Influencer / ads → developer portal → staff admin
12. Production readiness

## License

All rights reserved — see [LICENSE](LICENSE).
