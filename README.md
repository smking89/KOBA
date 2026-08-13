# KOBA

Infinite-scrolling social marketplace for game-server communities — trade skins,
maps, monuments, and cosmetics; follow shops and creators; find groups and
squads; all on one KOBAID.

## Status

**Phase 1 — Application foundation** is in progress on `chore/project-foundation`.

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
- Docker Compose PostgreSQL (Auth/Prisma land in Phase 3)
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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local database (optional until Phase 3)

```bash
docker compose up -d
```

Default URL (also in `.env.example`):

`postgresql://koba:koba@localhost:5432/koba?schema=public`

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
2. **Application foundation** ← current
3. PWA foundation
4. Database + Auth.js
5. Account types + KOBAID
6. Marketplace → shops → auctions → payments
7. Groups / LFG → social → DMs
8. Influencer / ads → developer portal → staff admin
9. Production readiness

## License

All rights reserved — see [LICENSE](LICENSE).
