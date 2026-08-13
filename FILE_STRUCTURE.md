# KOBA — File Structure

pnpm + Turborepo monorepo, per the stack decision in [ROADMAP.md](ROADMAP.md).
Every backend module directory maps to a specific roadmap phase — see the
`README.md` inside each one.

```
KOBA/
├── apps/
│   ├── web/                        Next.js + Tailwind frontend
│   │   └── src/
│   └── api/                        NestJS backend
│       └── src/
│           ├── common/             auth guard, RBAC guard, tagging interceptor, Stripe webhook middleware
│           └── modules/
│               ├── kobaid/             Phase 1  — KOBAID minting, format, issuance
│               ├── accounts/           Phase 2  — mode switching, capability flags
│               ├── marketplace/        Phase 3  — products, cosmetics, auctions, bids, orders, Stripe checkout
│               ├── shops/              Phase 4  — shop profile, analytics, promo settings, Stripe Connect
│               ├── groups/             Phase 5  — groups, community roles, LFG
│               ├── social/             Phase 6  — likes/comments/DMs/stories/block/report
│               ├── tagging/            Phase 6  — @mentions, tag privacy
│               ├── ads/                Phase 7  — KOBA Content Units (native ads)
│               ├── feed/               Phase 8  — unified ranked feed, pagination/caching
│               ├── developer-portal/   Phase 9  — Map Builder, KOBA APIs, sandbox, Blue Badge
│               ├── influencer/         Phase 10 — promo page, referral codes, payouts
│               └── roles/              Phase 11 — RBAC (Superadmin/Admin/Moderator)
│
├── packages/
│   ├── database/                   Prisma schema (Phase 12 integration point) + migrations
│   │   └── prisma/schema.prisma
│   ├── ui/                         shared design tokens/components, ported from design/ (Phase 0)
│   └── config/                     shared tsconfig/eslint/prettier
│
├── design/
│   └── ui-ux-design-system.html    Phase 0 deliverable — done
│
├── README.md
├── ROADMAP.md
├── FILE_STRUCTURE.md               this file
├── LICENSE
├── .gitignore
├── package.json                    workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

## Where Phase 13 (API routes) lives

No separate directory — routes are the controllers inside each
`apps/api/src/modules/*/` folder once that module is built (e.g. tagging
routes `/tags/create`, `/tags/delete`, `/tags/settings`, `/tags/suggestions`
live in `modules/tagging/`).

## What's real vs. placeholder right now

Every directory above exists. Nothing is bootstrapped yet — no
`package.json` inside `apps/web` or `apps/api`, no installed dependencies, no
Prisma models. Each `README.md` states what belongs there and which phase
fills it in. This is scaffolding, not a running app.
