# KOBA — Build Roadmap

Status: Phases 0–13 (the original client outline below) are all built and
merged to `main`, well beyond "planning only" — see `README.md`'s "Status"
and "Build plan" sections for the actively-maintained, ground-truth account
of what's actually shipped (this file drifted out of sync with reality
before; README is now the source of truth for _current_ status). This file
remains the canonical place for **forward-looking scope**: Phases 14+ below
are not yet built (except where a phase note says otherwise) and capture
product direction from the client that hasn't shipped yet.

This document turns the client's evolving outline into an actionable,
engineering-level build plan: concrete deliverables, data models, phase
dependencies, a single consistent tech stack, a sequencing plan, and the
open questions that need client decisions before (or during) each phase.

> Numbering note: this roadmap keeps the same phase numbers/order as the
> original outline (Phase 1 → Phase 13), then continues sequentially for
> newer client direction (Phase 14+). The repo README's "Build plan" list
> uses its own 1-indexed _steps_ that has evolved independently and no
> longer maps cleanly onto this file's numbering step-for-step — treat
> README as "what's done, in the order it shipped" and this file as
> "what each phase actually requires," cross-referenced by name/topic
> rather than by number.

---

## Table of contents

- [Tech stack (chosen once, used everywhere)](#tech-stack-chosen-once-used-everywhere)
- [Phase 1 — KOBAID + Account Types](#phase-1--kobaid--account-types)
- [Phase 2 — Account Switching Flow](#phase-2--account-switching-flow)
- [Phase 3 — Marketplace Core](#phase-3--marketplace-core)
- [Phase 4 — Shops + Business Tools](#phase-4--shops--business-tools)
- [Phase 5 — Groups + LFG](#phase-5--groups--lfg)
- [Phase 6 — Social Layer (tagging included)](#phase-6--social-layer-tagging-included)
- [Phase 7 — KOBA Ads (native)](#phase-7--koba-ads-native)
- [Phase 8 — Feed Engine](#phase-8--feed-engine)
- [Phase 9 — Developer Portal](#phase-9--developer-portal)
- [Phase 10 — Influencer System + Promo Page](#phase-10--influencer-system--promo-page)
- [Phase 11 — Role System (RBAC)](#phase-11--role-system-rbac)
- [Phase 12 — Database Schema (full integration)](#phase-12--database-schema-full-integration)
- [Phase 13 — API Routes](#phase-13--api-routes)
- [Phase 14 — Aiden AI Generation Suite (Vest / Graft / Terra)](#phase-14--aiden-ai-generation-suite-vest--graft--terra)
- [Phase 15 — KOBAads + Boost](#phase-15--kobaads--boost)
- [Phase 16 — KOBA Plus (subscriptions)](#phase-16--koba-plus-subscriptions)
- [Phase 17 — Game Server Directory + Live RCON](#phase-17--game-server-directory--live-rcon)
- [Phase 18 — Freebie Products (status: done)](#phase-18--freebie-products-status-done)
- [Phase 19 — Rarity-Matched Trading (status: done)](#phase-19--rarity-matched-trading-status-done)
- [Phase 20 — Multi-Subdomain Architecture](#phase-20--multi-subdomain-architecture)
- [Phase 21 — KOBA PC Plugin](#phase-21--koba-pc-plugin)
- [Phase 22 — Discord Bot](#phase-22--discord-bot)
- [Phase 23 — KOBA Shop (cosmetics storefront)](#phase-23--koba-shop-cosmetics-storefront)
- [Sequencing / milestones](#sequencing--milestones)
- [Open questions for the client](#open-questions-for-the-client)

---

## Tech stack (chosen once, used everywhere)

Picked once here and referenced (not re-litigated) in every phase below.
Rationale: this is a solo/small-team build of a single, deeply
interconnected domain (identity, marketplace, social, ads, feed, RBAC all
touch the same entities), so the priorities are (a) one language across
the stack to share types, (b) a relational core because the domain is
transactional and permission-heavy (orders, bids, payouts, RBAC), and
(c) boring, well-documented tools over novelty.

| Layer            | Choice                                                                                                                                           | Why                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language         | TypeScript, everywhere (frontend, backend, scripts)                                                                                              | One language, shared types between client/server via a monorepo, matches the JS-heavy prototype tooling                                                                                                      |
| Monorepo         | Turborepo + pnpm workspaces                                                                                                                      | Shared `packages/types`, `packages/ui` between web app and (future) mobile; incremental builds                                                                                                               |
| Frontend         | Next.js (App Router) + React + Tailwind CSS                                                                                                      | Tailwind's utility classes map cleanly onto the design tokens already established in `design/ui-ux-design-system.html`; Next.js gives SSR for feed/marketplace SEO and a single deploy artifact              |
| Backend          | Node.js + NestJS                                                                                                                                 | Opinionated module/DI structure fits a domain with 13+ bounded contexts (marketplace, shops, groups, ads, feed, dev portal, RBAC); built-in guards map directly onto the RBAC model in Phase 11              |
| Database         | PostgreSQL                                                                                                                                       | Relational integrity for money-adjacent data (orders, bids, payouts, referral codes) and RBAC joins; JSONB columns cover flexible fields (product metadata, KCU payloads) without a second database          |
| ORM / migrations | Prisma                                                                                                                                           | Type-safe schema shared with the monorepo; migration history doubles as a changelog for Phase 12                                                                                                             |
| Cache / queues   | Redis (+ BullMQ)                                                                                                                                 | Feed ranking cache and pagination cursors (Phase 8); background jobs for auction close, badge-eligibility checks, Stripe webhook processing, referral payout reconciliation                                  |
| Object storage   | S3-compatible (AWS S3 or Cloudflare R2 — see open questions)                                                                                     | Cosmetic/product images, shop banners, Map Builder assets, KCU creative assets                                                                                                                               |
| Payments         | Stripe Connect (Express accounts)                                                                                                                | Explicitly required for shops + influencer payouts (Phase 3/4/10); KOBA never stores government ID — identity verification is delegated to Stripe's own onboarding/dashboard and read back via API (Phase 4) |
| Realtime         | WebSockets (Socket.IO) for DMs/typing/presence; dedicated provider (see open questions) for voice/video calls                                    | DM text/stickers/vanish-mode is a straightforward socket problem; voice/video calls need a purpose-built SFU, not hand-rolled WebRTC                                                                         |
| Search           | Postgres full-text to start; revisit a dedicated search engine (Meilisearch/Typesense) once catalog size demands it                              | Avoids a second system prematurely; index strategy is part of Phase 12                                                                                                                                       |
| Auth             | Custom KOBAID-based auth (KOBAID is itself the identity primitive) layered over standard credential/OAuth login, session via JWT + refresh token | KOBAID format is bespoke to this product (Phase 1); underlying login mechanics (email/password, OAuth) are conventional and shouldn't be reinvented                                                          |
| Mobile           | Responsive web via Next.js first; native app (React Native, sharing `packages/types`/`packages/ui` logic) is a later, separately-scoped track    | See open questions — client has not confirmed native app scope                                                                                                                                               |
| Infra / hosting  | Not yet decided — see open questions                                                                                                             | Stack above works on Vercel+Render/Fly, or a single AWS/GCP account; decision affects Phase 12 sharding notes and file storage choice                                                                        |
| CI               | GitHub Actions                                                                                                                                   | Repo already lives on GitHub                                                                                                                                                                                 |

---

## Phase 1 — KOBAID + Account Types

**Scope, as engineering deliverables**

- Design and implement the KOBAID _format_: `KOBA-XX-XXXX`, atomic (generated once, never edited in place — corrections are a new issuance + ledger entry, not a mutation), role-coded (`PL`/`BZ`/`IN` community roles, `SA`/`AD`/`MD` staff roles).
- Implement TDLS encryption for the KOBAID payload/metadata at rest and in transit. _(TDLS is a client-defined term used in the design prototype; its exact algorithm/spec is not yet documented anywhere in the repo — flagged as an open question below. Treat this phase's TDLS work as "wire up to whatever TDLS turns out to mean" once specified.)_
- Enforce "one KOBAID per role per device" at issuance time — device fingerprint/binding check, not just a UI toggle.
- Staff KOBAID issuance flow: staff codes (`SA`/`AD`/`MD`) are created by an existing admin via an internal issuance action, never via public self-registration. Community roles (`PL`/`BZ`/`IN`) are self-registered.
- Badge-icon suppression logic: staff roles (`SA`/`AD`/`MD`) never render a badge anywhere in the UI; this is a rendering rule, not a data flag, and must be enforced server-side (i.e., staff role objects should not even carry a "badge" field that a careless frontend could render).
- Player/Business/Influencer _capability_ definitions: what each role can and can't do, expressed as a capability-flag set attached to the KOBAID (not hardcoded role checks scattered through the app) so Phase 2's switching logic and Phase 11's RBAC can both read from the same source.
- Mandatory interest selection at onboarding: minimum 4 hashtags/interest tags, validated at registration, feeds Phase 8's ranking signals later.
- KOBAID metadata fields for: cosmetic ownership (pointer/join to owned cosmetics, not the cosmetics themselves — see Phase 3), referral/promo code association (pointer to Phase 10's referral codes).

**Data models / entities**

- `KobaId` (id, code, role_type, owner_user_id, device_binding_id, issued_by [nullable, staff issuer], issued_at, status)
- `User` (auth identity distinct from KobaId — a user _has_ one or more KobaIds, one per role per device)
- `CapabilityFlagSet` (per role_type, defines allowed actions — read by Phase 2 and Phase 11)
- `InterestTag` (canonical hashtag list) and `UserInterest` (join, min 4 enforced at write time)
- `KobaIdMetadata` (kobaid_id, cosmetic_ownership_ref, referral_code_ref)
- `StaffIssuanceLog` (issuer_kobaid_id, issued_kobaid_id, timestamp) — audit trail, also feeds Phase 11's admin action

**Dependencies on earlier phases**

- None — this is the foundation everything else is built on.

---

## Phase 2 — Account Switching Flow

**Scope, as engineering deliverables**

- Settings UI + backend endpoint to switch active mode among Player/Business/Influencer for a given user (each mode maps to a distinct KOBAID per Phase 1's "one per role per device" rule — switching is really "activate a different KOBAID," not mutating one KOBAID's role).
- Business mode activation: unlocks shop tools, product uploads, ad creation, and dev-portal access (dev-portal _access_ is gated here; dev-portal _functionality_ is built in Phase 9).
- Influencer mode activation: unlocks promo page, referral code generation UI, earnings dashboard (functionality built in Phase 10; this phase only wires the mode gate).
- Player mode: hides all business/influencer tooling from nav/UI — this must be a capability-flag check (from Phase 1), not per-screen hardcoding.
- Tagging permission changes per mode (permission _rules_ defined here; tag _rendering/enforcement_ is Phase 6 — this phase just needs the mode-to-permission mapping to exist and be queryable).
- Explicit non-goal carried over from the outline: cosmetic visibility must NOT change when switching modes — write a regression test/checklist item for this since it's an easy thing to accidentally couple to mode state.

**Data models / entities**

- `AccountModeState` (user_id, active_kobaid_id, active_role_type, last_switched_at)
- Extends `CapabilityFlagSet` from Phase 1 (read, not redefined here)
- `TagPermissionRule` (role_type → allowed tag actions) — schema only in this phase, enforced in Phase 6

**Dependencies**

- Phase 1 (KOBAID + capability flags must exist first).

---

## Phase 3 — Marketplace Core

**Scope, as engineering deliverables**

- `Product` model covering four listing kinds: skins, maps, monuments, and generic "assets" (game-specific tradeable items), plus a separate cosmetics track.
- Cosmetics constrained explicitly to six sub-types — Avatar Decoration, Profile Effect, Nameplate, Profile Frame, Shop Banner, Emoji (expanded from the original three per client direction, see Phase 16) — sold pre-made, never assembled/configured by the buyer. Enforce this at the schema level (cosmetic sub-type enum, no "custom build" fields) so Phase 9's Map Builder doesn't accidentally become a precedent for a "cosmetic builder."
- Auction engine: start price, minimum bid increment, end time, auto-extend-on-last-second-bid rule (recommend adding this even though not explicitly requested — flag as a decision, not a silent addition).
- Bid model with optimistic concurrency (bids must not lose a race under load) and audit trail.
- Order model covering both fixed-price purchases and won-auction settlements.
- 6-tier rarity system: common → uncommon → rare → epic → legendary → relic (naming to be confirmed with client — outline says "relic" as the top tier but doesn't name tiers 2-5; recommend the above as the working default, flag for confirmation).
- Stripe Connect integration: Express accounts for shops (Phase 4) and influencers (Phase 10); this phase builds the underlying payment/payout plumbing both consume.
- Platform fee: KOBA takes a cut on every settled order — needs a configurable fee schedule (flat %, possibly tiered later) computed at settlement time, not just at checkout, so refunds/disputes recompute correctly.

**Data models / entities**

- `Product` (id, kobaid_owner, type [skin|map|monument|asset], game_id, rarity_tier, price_type [fixed|auction], metadata JSONB)
- `Cosmetic` (id, kobaid_owner_or_shop, sub_type [avatar_decoration|profile_effect|nameplate], rarity_tier) — separate table from `Product` since cosmetics have a closed sub-type enum and different ownership semantics (cosmetic ownership also referenced from Phase 1's `KobaIdMetadata`)
- `Auction` (product_id, start_price, min_increment, start_at, end_at, status)
- `Bid` (auction_id, bidder_kobaid_id, amount, placed_at)
- `Order` (buyer_kobaid_id, seller_kobaid_id/shop_id, product_or_cosmetic_ref, amount, platform_fee_amount, stripe_payment_intent_id, status)
- `RarityTier` (enum/lookup table: common, uncommon, rare, epic, legendary, relic)
- `StripeAccountLink` (kobaid_or_shop_id, stripe_account_id, onboarding_status) — shared plumbing consumed by Phase 4 and Phase 10

**Dependencies**

- Phase 1 (KOBAID as owner/buyer/seller identity).
- Phase 2 not strictly required but expected to exist first in practice (Business mode is how sellers list products).

---

## Phase 4 — Shops + Business Tools

**Scope, as engineering deliverables**

- `Shop` model: bio, banner, avatar, plus the operational surface — analytics dashboard, product management (CRUD over Phase 3's `Product`/`Cosmetic`), rarity distribution reporting (what % of a shop's catalog is common vs. relic, etc.), followers, tagging permissions specific to shops.
- Stripe connection flow (onboarding UI wrapping Phase 3's `StripeAccountLink` plumbing).
- Promo settings: enable/disable influencer eligibility for the shop's products, and set payout terms (percentage or fixed rate) — this is the shop-side half of Phase 10's influencer payout config.
- Explicit non-goal carried over from the outline: KOBA's backend never collects or stores government ID. Business identity/KYC lives entirely in Stripe's own dashboard; KOBA only reads verification _status_ back via the Stripe API. This should be a hard architectural constraint, not just a policy note — no `government_id` field should ever exist in this schema.

**Data models / entities**

- `Shop` (id, owner_kobaid_id [must be BZ role], bio, banner_url, avatar_url, follower_count_cache)
- `ShopFollower` (shop_id, follower_kobaid_id)
- `ShopAnalyticsSnapshot` (shop_id, period, views, sales, conversion — precomputed rollups, not live-queried every page load)
- `ShopPromoConfig` (shop_id, influencer_eligible boolean, payout_type [percent|fixed], payout_value)
- Extends `StripeAccountLink` from Phase 3 with shop-specific onboarding state

**Dependencies**

- Phase 1 (Business KOBAID), Phase 3 (Product/Cosmetic/Stripe plumbing).

---

## Phase 5 — Groups + LFG

**Scope, as engineering deliverables**

- `Group` model: public/private visibility, group feed (a scoped view into Phase 8's feed engine once that exists — build the group feed's data shape now, wire it into the ranked feed later).
- Membership roles: Owner/Admin/Moderator/Member — explicitly a **community-level** role attached to a normal Player/Business KOBAID, distinct from Phase 11's platform staff roles. Model these as two entirely separate enums/tables from day one to avoid any future conflation (this distinction is called out twice in the source material — treat it as a hard requirement, not a nice-to-have).
- LFG (Looking-For-Group) post model: game, mode, requirements (free-text or structured — recommend structured with a free-text fallback field), slot count, expiration.
- Group-scoped tagging permissions (rules defined here, enforced by Phase 6's tagging engine).
- Cosmetic display in group member profiles (reads Phase 3 cosmetic ownership; no new cosmetic logic).

**Data models / entities**

- `Group` (id, name, visibility [public|private], owner_kobaid_id, created_at)
- `GroupMembership` (group_id, member_kobaid_id, community_role [owner|admin|moderator|member]) — deliberately named `community_role` to avoid collision with Phase 11's `staff_role`
- `LfgPost` (group_id_or_null, author_kobaid_id, game_id, mode, requirements JSONB, slot_count, filled_count, expires_at)
- `GroupTagPermissionRule` (group_id, community_role → allowed tag actions)

**Dependencies**

- Phase 1 (KOBAID), Phase 3 (cosmetic display references product/cosmetic data).
- Soft dependency on Phase 8 (group feed will eventually plug into the unified feed, but can ship with its own simple reverse-chronological view first).

---

## Phase 6 — Social Layer (tagging included)

**Scope, as engineering deliverables**

- `SocialAction` model covering like/comment/share/repost/story as a single polymorphic action type (or a small family of related tables — decide during schema design in Phase 12, model the concept now).
- DM system: text, stickers, voice messages, voice/video calls, and "Vanish Mode" disappearing messages. Voice/video calls in particular are a distinct technical subsystem (see tech stack's realtime row and the open question on call provider) — scope it separately from the text/sticker/voice-message DM CRUD, which is comparatively simple.
- Block/Report rules: blocking must cascade into tag suggestions, DM delivery, feed visibility, and search — write this as a single enforcement checkpoint (e.g., a shared `isBlocked(a,b)` check) reused everywhere rather than re-implemented per feature.
- `TagAction` model: `tagger_id`, `target_id`, `target_type`, `context_type`, `timestamp` — exactly as specified in the outline; `target_type` covers player/shop/product at minimum (confirm full enum during implementation).
- Tag rendering: `@mentions` for players, shops, and products, with autocomplete/suggestions.
- Tag privacy settings per role (reads Phase 2's per-mode tag permission mapping and Phase 5's group-scoped rules).
- Tagging permission changes on account-mode switch (the enforcement half of what Phase 2 only modeled).

**Data models / entities**

- `SocialAction` (id, actor_kobaid_id, action_type [like|comment|share|repost|story], target_id, target_type, content JSONB, created_at)
- `DirectMessage` (thread_id, sender_kobaid_id, type [text|sticker|voice|call_event], content, vanish_mode boolean, expires_at)
- `DmThread` (participants, vanish_mode_default)
- `CallSession` (thread_id, participants, started_at, ended_at, provider_session_id)
- `BlockRelation` (blocker_kobaid_id, blocked_kobaid_id, created_at)
- `Report` (reporter_kobaid_id, target_id, target_type, reason, status)
- `TagAction` (tagger_id, target_id, target_type, context_type, timestamp)
- `TagPrivacySetting` (kobaid_id or role_type, who_can_tag_me enum)

**Dependencies**

- Phase 1 (KOBAID), Phase 2 (mode-based tag permission mapping), Phase 5 (group-scoped tag rules feed into this phase's enforcement).

---

## Phase 7 — KOBA Ads (native)

**Scope, as engineering deliverables**

- KOBA Content Unit (KCU) spec: a formal schema for "a piece of content that can appear in the feed," shared by organic content and ads so rendering code doesn't fork.
- `sponsored` flag on KCUs; native rendering must be visually/structurally identical to organic content across every ad type: product, shop, group, creator, LFG, and cosmetic ads.
- Ads respect the same tagging permission rules as organic content (Phase 6) and expose the _correct_ action buttons per ad type (e.g., a product ad gets "Buy"/"View listing," a group ad gets "Join," etc. — enumerate this mapping explicitly during implementation).
- Ads pause entirely in Player mode — this is a hard business rule (ads are a Business-mode monetization surface; Player mode should never render sponsored KCUs), enforce it at the feed query layer, not just client-side hiding.

**Data models / entities**

- `KcuUnit` (id, content_type [product|shop|group|creator|lfg|cosmetic], sponsored boolean, source_ref_id, created_by_kobaid_id, targeting JSONB)
- `AdCampaign` (kcu_id, shop_or_influencer_id, budget, spend_to_date, targeting_criteria, status, start_at, end_at)
- `AdImpressionLog` / `AdClickLog` (for billing and Phase 8 ranking signal input)

**Dependencies**

- Phase 3/4 (products/shops being advertised), Phase 5 (groups/LFG being advertised), Phase 6 (tag permission enforcement), and functionally precedes/parallels Phase 8 (feed engine is what actually interleaves KCUs — build the KCU spec here, wire ranking in Phase 8).

---

## Phase 8 — Feed Engine

**Status: shipped (2026-08-15).** Real ranked, cursor-paginated feed with
an optionally Redis-backed cache — not the plain reverse-chron feed this
section used to describe. See
[features/social/lib/feed-ranking.ts](../features/social/lib/feed-ranking.ts)
for the full signal weighting and honest documentation of which signals
are real vs. deliberately stubbed at weight 0.

**What's real:**

- `computePostScore` combines exponential recency decay (30h half-life)
  with a log-scaled engagement score (reactions/comments/saves — no
  denormalized counters exist, computed live via `_count`) and three real
  boost signals: following (Phase 6 `UserFollow`), group membership
  (Phase 5 `GroupMember`), and shop relevance (a post tagging a `Shop`
  the viewer follows, via `ShopFollow` + `PostTag`). A post in a
  currently-**Boosted** group (Phase 15) gets the Boost's literal 3x
  multiplier — the first real cross-phase use of Boost's "or any
  supported feature" design.
- The pre-Phase-8 feed used "following" as a hard **filter** — a
  signed-in viewer literally could not see a public post from someone
  they didn't follow. That was a real bug, not a design choice; fixed as
  part of this phase — the feed is now the whole public corpus (bounded
  to a 30-day/300-post candidate window, see below), ranked, with
  followed authors pushed up rather than everyone else being invisible.
- Cursor-based pagination (`encodeFeedCursor`/`decodeFeedCursor`,
  base64 `{score, id}`), replacing the old `page`/`pageSize` offset API —
  a breaking change to `GET /api/social/feed`'s query shape and to
  `FeedList`'s "Load more".
- Redis-backed ranking cache (`features/social/lib/feed-cache.ts`):
  Upstash REST when configured, in-memory fallback otherwise — same
  fail-soft shape as `lib/security/rate-limit.ts`. Only the ranked
  `(score, id)` list is cached (30s TTL); actual post content is always
  fetched fresh by id, so a cache hit can never serve stale/edited/
  moderated content.

**What's deliberately stubbed at weight 0, not fabricated** (turning one
on is a config change in `feed-ranking.ts`, not new plumbing, once the
underlying data exists):

- **User interests** — Phase 1 named this as a Phase 8 input ("minimum 4
  hashtags/interest tags... feeds Phase 8's ranking signals later") but
  no interest-capture at registration or `Interest`/`Tag`-on-`User` model
  was ever built. Still open — see open questions.
- **Ad targeting** (Phase 7 KOBAads) — no `Ad`/`AdCampaign` model exists
  yet (Phase 15, still planning-only).
- **Influencer promo activity** (Phase 10) — already named a soft
  dependency in this section originally; still stubbable.
- **Cosmetic engagement** (Phase 3) — no instrumentation tracks this
  anywhere; would need its own event log before it could be a real
  signal.

**Known scaling limit, not a bug:** ranking happens over a bounded
candidate window (last 30 days, 300 most-recent posts) scored in
application code, not a DB-level computed column or search index. Correct
and real at KOBA's current data volume; ranking a much larger/older
corpus would need a materialized score column or a dedicated search
engine (Meilisearch/Typesense/Algolia — ROADMAP.md open question #9),
not a bigger constant.

**Also discovered, not fixed here (separate, smaller, pre-existing bug):**
`listProfilePosts` (a profile's own post history, Phase 6) still uses
page-number pagination and its "Load more" posts back to
`/api/social/feed` — the _global_ ranked feed endpoint, not an
author-scoped one. That mismatch predates this phase; fixing it needs a
dedicated author-scoped feed route, tracked as follow-up, not silently
left unmentioned.

**Data models / entities**

- No new persisted models — ranking weights are an in-code config
  (`FEED_RANKING_WEIGHTS`, following the same `readonly [...] as const`
  convention as `features/wallet/lib/coin-packages.ts`) rather than a DB
  table. A superadmin-configurable weights table (mirroring
  `PlatformFunctionFlag`'s pattern) is a natural fast-follow if ranking
  needs to be tunable without a deploy, not required for this to be real.
- No `FeedCacheEntry` table — the Redis cache is a plain key/value
  (`feed:{viewerId|anon}:{groupId|all}` → ranked id list), not a Prisma
  model, consistent with how `lib/security/rate-limit.ts` uses Upstash.

**Dependencies**

- Phases 1, 3, 5, 6 (real signal sources, done). Phase 7 (ad targeting)
  and Phase 10 (influencer promo) signals are stubbed at 0 until those
  phases exist — no schema change needed to turn them on later. Phase 15
  (Boost) is now a real, wired dependency, not just planning.

**Open questions for the client**

1. User interests — is Phase 1's registration-time interest capture
   ("minimum 4 hashtags") still in scope, and if so what's the tag
   taxonomy? Blocks turning the `interestMatch` signal on above 0.

---

## Phase 9 — Developer Portal

**App Store storefront rebuilt (2026-08-17)** — `app.koba.games` (`/apps`,
`/apps/[slug]`) needed its own genuinely distinct GUI/UI/UX, not KOBA's
dark AppShell sidebar (client, 2026-08-17). Moved to a new `(store)`
route group with its own standalone layout (no shared sidebar) and a
real light theme scoped to a `.koba-store` CSS class
(`app/globals.css`) — the rest of KOBA stays dark-only, this is a
genuine second visual identity, not a global theme toggle. Card grid,
category tabs, search, a real "Popular this week" rail (sorted by actual
`downloadCount`, not editorial picks), and the detail page (hero,
screenshots, versions, reviews, similar apps) all keep the exact same
business logic as before (`PurchaseButton`, entitlement checks, version
downloads) — this was a visual rebuild, not a logic rewrite. Verified
against real seeded data (inserted and cleaned up after screenshot
verification, not left in the dev DB) and a real production build.
**Scope, as engineering deliverables**

- Access gate: Business-mode only (reuses Phase 2's mode gating).
- Map Builder: the one genuine "builder" in the product — skins/monuments/cosmetics are uploaded pre-made, packs are just bundles of existing products (no packing/building logic needed beyond a bundle reference list). Scope Map Builder as its own substantial feature (asset placement, terrain/prefab tooling scoped per-game — this will need its own design pass per supported PC game, since RCON/modding capabilities differ by title per the README's supported-games table).
- KOBA APIs exposed to developers: AI Behavior, Faction Simulation, Event Trigger, Logistics, Pack Metadata (NPC Personality removed from scope, client 2026-08-17). Each is effectively its own mini-product — recommend treating each as a separately versioned API surface with its own docs/sandbox rather than one monolithic "dev API." **Catalog/docs pages shipped (2026-08-17)** — `/developers/apis` + `/developers/apis/[slug]` (`features/developers/lib/api-catalog.ts`), one page per surface with real use cases and a capability list grounded in what each surface is actually for. All 5 are marked `status: "planned"` honestly — no surface has a live endpoint yet, so the pages are documentation-ahead-of-build, not a callable API reference. Pricing intentionally reads "Coming soon" everywhere (client decision, 2026-08-17: ship the catalog now, price later) rather than an invented number. Still needed: the real backing endpoints themselves (this phase's actual API implementation), and per-surface `DevApiCredential`-style scoping once pricing/access tiers are decided — today every surface just points at the existing generic developer API key system.
- Sandbox testing environment isolated from production marketplace data.
- Instant publishing: explicitly no manual review gate to publish (contrast with Phase 4's shop identity flow, which _is_ Stripe-gated, and with the Blue Badge below, which _does_ require manual review — publishing itself does not).
- Creator earnings dashboard (reads Order/payout data from Phase 3/4).
- KOBA Blue Badge eligibility tracking: automated tracking of the four numeric thresholds (1,000+ followers, 4.0★+ shop rating, account 30+ days old, $2,500+ gross sales in a rolling 30-day window, refunds/manipulated purchases excluded from that figure) feeding a queue for manual KOBA staff review — badge is never auto-granted even when all four thresholds are met. Auto-removal job: badge is stripped automatically if any threshold is breached, or on fraud/report-spike/rule-violation signals (ties into Phase 6's `Report` model and Phase 11's moderation actions).

**Data models / entities**

- `DevPortalAsset` (map builder projects, pack bundle definitions — bundles reference existing `Product`/`Cosmetic` ids, they don't create new asset types)
- `DevApiCredential` (kobaid_owner [BZ], api_surface [ai_behavior|faction_sim|event_trigger|logistics|npc_personality|pack_metadata], key, sandbox boolean)
- `BlueBadgeEligibilitySnapshot` (shop_id, followers, rating, account_age_days, gross_sales_30d, computed_at, meets_thresholds boolean)
- `BlueBadgeReviewQueueEntry` (shop_id, snapshot_ref, status [pending|approved|rejected], reviewer_kobaid_id [staff])
- `BlueBadgeGrant` (shop_id, granted_at, revoked_at, revoke_reason)

**Dependencies**

- Phase 2 (Business-mode gate), Phase 3 (packs bundle existing products/cosmetics, earnings from Order data), Phase 4 (shop rating/follower/sales figures feed badge eligibility), Phase 6 (fraud/report signals feed auto-removal), Phase 11 (staff review action).

---

## Phase 10 — Influencer System + Promo Page

**Scope, as engineering deliverables**

- Promo page: an Influencer-mode surface (gated by Phase 2) showing the influencer's active referral codes and stats.
- Referral code generation: unique per product, and the code itself includes the influencer's username (format decision to confirm with client, e.g. `USERNAME-PRODUCTID` style).
- Referral sales/earnings tracking: attribute an `Order` (Phase 3) to a referral code when present, compute influencer earnings from the shop's `ShopPromoConfig` payout terms (Phase 4).
- Stripe-based payout execution using the plumbing built in Phase 3/4 (`StripeAccountLink`), configured by the shop, not the influencer.
- Influencer analytics dashboard (clicks, conversions, earnings over time).
- Influencer tagging permissions (reads/extends Phase 6's tag privacy settings for the `IN` role).

**Data models / entities**

- `ReferralCode` (id, code, influencer_kobaid_id, product_id, shop_id, created_at, active boolean)
- `ReferralAttribution` (order_id, referral_code_id) — links back to Phase 3's `Order`
- `InfluencerEarning` (influencer_kobaid_id, referral_code_id, order_id, amount, payout_status, stripe_transfer_id)
- `InfluencerAnalyticsSnapshot` (influencer_kobaid_id, period, clicks, conversions, earnings)

**Dependencies**

- Phase 1 (Influencer KOBAID), Phase 2 (mode gate), Phase 3 (Order/Stripe plumbing), Phase 4 (shop-side promo config sets the payout terms this phase reads).

---

## Phase 11 — Role System (RBAC)

**Scope, as engineering deliverables**

- Formalize the three internal staff roles as an RBAC system: Superadmin (full control including global financials), Admin (high-level management, explicitly excluding core system settings and global financials), Moderator (reports/warnings/suspensions only).
- All three are staff roles with **no badge icon** (per Phase 1) — they are distinguished only by KOBAID format (`SA`/`AD`/`MD`) and by which sections of the admin panel they can see/act in. This phase builds the actual permission-check middleware/guards (NestJS guards, per the chosen stack) that enforce that distinction server-side.
- Admin action: manually issue a new KOBAID to a role (this is the implementation of Phase 1's `StaffIssuanceLog` concept as a real admin-panel feature, with its own permission check — e.g., does issuing a Superadmin code require an existing Superadmin, not just any Admin? Flag as a decision).
- Moderator actions scoped narrowly to: acting on `Report`s (Phase 6), issuing warnings, and suspending accounts — explicitly no access to financials or core settings.
- Admin actions: broader account/content/shop management, but still no access to global financial reporting or core system configuration (only Superadmin gets that).

**Data models / entities**

- `StaffRole` enum (superadmin|admin|moderator) — kept structurally separate from Phase 5's `community_role` enum, as noted there.
- `Permission` / `RolePermission` (staff_role → allowed permission keys) — the actual RBAC table the guards read.
- `ModerationAction` (moderator_kobaid_id, target_id, target_type, action_type [warning|suspension|report_resolution], reason, created_at)
- Extends Phase 1's `StaffIssuanceLog` with the concrete admin-panel action and its own permission check.

**Dependencies**

- Phase 1 (staff KOBAID format), Phase 6 (Report model that Moderators act on).

---

## Phase 12 — Database Schema (full integration)

**This phase is deliberately the integration checkpoint.** Per the client's explicit instruction, Phase 12 is "the only session where full schema context is pasted" — i.e., don't try to design the unified schema piecemeal inside earlier phases; each earlier phase above proposes its own entities in isolation, and Phase 12 is where all of them get reconciled into one coherent Prisma schema in a single sitting with full context loaded.

**Scope, as engineering deliverables**

- Unify every model proposed in Phases 1-11 into one schema: Users, KOBAID ledger, Products, Cosmetics, Auctions, Bids, Orders, Shops, Groups, LFG posts, SocialActions, TagActions, Ads (KCUs), Feed units, Developer portal assets, Influencer promo codes, Influencer earnings, Role permissions.
- Resolve naming collisions flagged in earlier phases (e.g., `community_role` vs `staff_role` must remain distinct tables/enums, not merged for "consistency").
- Foreign key / referential integrity pass across all domains (e.g., `Order.referral_code_id` nullable FK to `ReferralCode`, `Order.buyer_kobaid_id`/`seller_kobaid_id` FKs, cascade/restrict rules for deletes — especially around KOBAID immutability from Phase 1, which implies most FKs to `KobaId` should be `RESTRICT`, not `CASCADE`).
- Indexing strategy: at minimum, cover feed query patterns (Phase 8), auction end-time sweeps (Phase 3), tag/mention lookups (Phase 6), and rating/follower rollups used by Blue Badge eligibility (Phase 9).
- Sharding strategy: decide whether/when horizontal sharding is needed (likely not at launch — flag as a "design for it, don't build it yet" decision; candidate shard key would be `kobaid_owner`/`shop_id` for marketplace data if/when needed).
- Produce the actual Prisma schema file(s) and initial migration as the deliverable of this phase.

**Dependencies**

- Phases 1-11 (this phase only reconciles what they've each proposed — it should not introduce new product requirements).

---

## Phase 13 — API Routes

**Scope, as engineering deliverables**

- Implement the full REST (or REST+RPC, per NestJS conventions) surface over the Phase 12 schema: auth, KOBAID, marketplace, cosmetic, shop, Stripe connection, group, LFG, social, tagging (`/tags/create`, `/tags/delete`, `/tags/settings`, `/tags/suggestions`), ads, feed, developer portal, influencer promo, role management, settings routes.
- Each route group maps to a NestJS module, each guarded by the RBAC guards built in Phase 11 and the capability-flag checks from Phase 1/2.
- API contract (OpenAPI/Swagger, generated from NestJS decorators) as a deliverable, so the frontend and any future third-party developer-portal consumers (Phase 9) have a single source of truth.

**Data models / entities**

- No new entities — this phase is the HTTP surface over Phase 12's schema.

**Dependencies**

- Phase 12 (full schema must exist first, per the client's explicit sequencing).

---

## Phase 14 — Aiden AI Generation Suite (Vest / Graft / Terra)

**Status: real pipeline built (Aiden Studio OS); Vest/Graft now call real
vendors (Replicate + Tripo) for image/3D asset types; Terra (map/terrain)
still has no vendor.** See [docs/aiden-studio-os.md](docs/aiden-studio-os.md)
for the full architecture. What's real:

- **Aiden Studio OS** (`features/aiden/os/`): a generic Master/Adapter/
  Orchestration/Category/Agent runtime — every node is a real Agent/
  Kernel/Engine/Sandbox component built from one shared factory
  (`shared/compose.ts`). Five adapter kinds (external model, local model,
  agent, tool, workflow) give it genuine plug-n-play: any of those can be
  wrapped into the same routable shape. `GENERATION` is the only category
  with real agents (Vest/Graft/Terra); `LOGIC`/`DATA`/`AUTOMATION`/
  `INTERFACE` are real, routable category shells with empty registries,
  ready for their first feature.
- **Cost reconciliation**: `AidenJob.coinCostActual` +
  `frontierModelUsageJson` record the provider's real cost (once a real
  vendor exists) for audit, converted to Coins at the same $0.01 = 1 Coin
  rate live purchases use (`features/aiden/lib/cost.ts`). The reservation
  is still always captured in full at `coinCostPreview` — releasing the
  preview/actual delta is a deferred refinement (documented on the
  schema field itself).
- **Vest/Graft providers now call real vendors, split by asset type
  within each product** (2026-08-15, client-specified model list):
  `features/aiden/providers/replicate-provider.ts` (SDXL/Kandinsky image
  generation, official-model endpoint, no pinned version hash to go
  stale) and `features/aiden/providers/tripo-provider.ts` (text-to-3D,
  optionally chained with an auto-rig pass). `CONCEPT_IMAGE`/`TEXTURE`
  → Replicate; `SKIN` → Tripo text-to-3D + auto-rig (the original "fully
  rigged, animated, game-ready" recommendation); `PROP` → Tripo
  text-to-3D only (static prop); `ANIMATION` → Tripo + auto-rig. Both
  fail closed on a missing `REPLICATE_API_TOKEN`/`TRIPO_API_KEY`, same
  pattern as `isStripeConfigured`. **Terra has no vendor at all** — no
  map/terrain model was in the client's list; `terraProvider` still
  fails closed unconditionally, exactly as before.
- **Confidence note on the Tripo integration**: the task create/poll
  shape (`POST /v2/openapi/task`, `GET /v2/openapi/task/{id}`) is
  confirmed against Tripo's published API examples. The auto-rig
  chaining call's exact field name (`animate_rig` task type,
  `original_model_task_id` field) is inferred from Tripo's documented
  task-type list, not confirmed against a live example — their docs
  site didn't render in this environment. Flagged in code
  (`tripo-provider.ts`); verify before relying on it in production. If
  wrong, it fails loudly (`TripoGenerationError`), not silently.
- **Cost reconciliation is now real for wired models**: `coinCostForModel`
  (`features/aiden/lib/model-costs.ts`) gives the fixed, known Coin cost
  per model (Replicate/Tripo return no per-request USD figure to read
  back), and `features/aiden/lib/cost-preview.ts`'s `coinCostForAssetType`
  — the reservation amount taken _before_ generation runs — was
  corrected to match those real numbers (it previously held arbitrary
  40-120 coin placeholders that had nothing to do with actual model
  cost, a stale mismatch from before real vendors existed).
- The `/aiden/generate` UI now actually submits to `POST /api/aiden/jobs`
  (previously a non-functional mock button) and shows real failure
  reasons; `/aiden/library` links to `assetUrl` once a real generation
  exists.

**Still missing:**

- **Terra (map/terrain) vendor** — genuinely unresolved, no model was
  given for this modality. Also unresolved regardless of vendor:
  converting a generated mesh/texture into a specific game's actual file
  format (FBX export, skeleton retargeting to that game's animation set)
  is deterministic glue work KOBA has to build itself (e.g. a headless
  Blender automation service) — no vendor does this step.
- ~~Successful generations publishing directly to the KOBA marketplace~~
  **shipped 2026-08-15**: `publishAssetToMarketplace`
  (`features/aiden/services/aiden.service.ts`) creates a real DRAFT
  `Product` (via the same `createSellerProduct` a manual listing form
  calls) from a generated asset, attaches its `assetUrl` as
  `ProductMedia`, and links `AidenAsset.publishedProductId` so an asset
  can only publish once. The Product still goes through the existing
  seller-submit → staff-review pipeline — no bypass. Every
  `AidenAssetType` maps to a required `Category.kind` at publish time
  (`features/aiden/lib/marketplace-mapping.ts`; `CONCEPT_IMAGE` maps to
  null — concepts aren't publishable). Aiden asset types never map to
  `Cosmetic` — nothing in `AidenAssetType` conceptually produces a
  KOBA-identity item (nameplate/avatar decoration/etc.), only
  marketplace `Product` content. `/aiden/library`'s "Publish to shop"
  button is now real (was previously always disabled/non-functional).

**Data models / entities**

- `AidenJob.coinCostActual` (Int?), `AidenJob.frontierModelUsageJson`
  (Text?), `AidenAsset.assetUrl` (Text?) — all shipped, additive.
- No `productType` column was added — Vest/Graft/Terra are a pure
  function of the existing `assetType` enum
  (`features/aiden/providers/types.ts#productForAssetType`), not a second
  source of truth.
- No new reservation/ledger model needed — `CoinReservation` already
  supports reserve/capture/release, per the Coins-ledger work already
  shipped.

**Dependencies**

- Live Coin purchases (done — this phase's funding path).
- `CoinReservation` lifecycle (done).
- Aiden Studio OS (done, this phase).

**Open questions for the client**

1. Frontier model **provider** per modality — resolved for images and 3D
   (2026-08-15): SDXL/Kandinsky via Replicate, Tripo via its own direct
   API — both wired for real (`replicate-provider.ts`/`tripo-provider.ts`).
   Video (Hunyuan/Luma/Flux) is explicitly **out of scope for now** per
   client direction, so no hosting-platform decision is needed for those.
   **Still open: Terra's vendor** — no map/terrain model was named at
   all; this modality remains fully unresolved, not just unwired.
2. Exchange rate: USD-cost-of-generation → KOBA Coins. Fixed multiplier,
   or does it track the same live Coin-purchase pricing (Phase 15,
   `features/wallet/lib/coin-packages.ts`)?
3. Failure/retry policy — if a frontier-model call fails or returns a
   low-quality result, is the reservation fully released, partially
   captured (compute was spent even if output was rejected), or does the
   user get one free retry?

### Reactive / Progressive Skins — new scope, split across two phases

Client direction (2026-08-15): "Dynamic outfits that evolve, glow, or
change stages based on your in-game performance or kills during a
match." This genuinely splits into two halves with very different
status — flagging that split now rather than scoping it as one feature,
because the two halves have nothing in common technically:

- **Generation half (this phase, buildable now)**: a "reactive skin"
  is really N linked static assets (stage 1 default, stage 2 mid-streak
  glow, stage 3 max-streak state, etc.), each a normal Aiden generation.
  Nothing new needed in `replicate-provider.ts`/`tripo-provider.ts`
  themselves — this is a new grouping concept (`AidenAsset` rows linked
  as one "stage set") plus a marketplace-side concept for a multi-stage
  `Product` (or a `Product` with N stage-tagged `ProductMedia` rows) that
  doesn't exist yet.
- **Runtime half (fully blocked, not just unwired)**: actually _swapping_
  the equipped stage live, in a running match, based on real kill/score
  telemetry, needs two things that are **0% built**:
  1. A way for a live match's performance to reach KOBA at all. Phase
     17's RCON integration is aggregate server state (player count, map)
     polled from `GameServer`, not per-player, per-match event telemetry
     (a kill happened, a score changed) — this is a different, harder
     integration problem, likely per-game (does the game's mod/plugin
     API even expose kill events? Rust and Garry's Mod might; many
     titles won't).
  2. Something running **locally on the player's machine during the
     match** that can hot-swap the equipped skin file/config the instant
     a stage threshold is crossed — this is exactly Phase 21's KOBA PC
     Plugin, which today is not just "unwired" but doesn't exist as a
     codebase at all (no OAuth device-flow infra, no plugin project,
     Phase 21 status: fully planning-only).

**Not buildable today as a live, reactive feature** — the generation
half can ship once the multi-stage grouping concept is designed; the
runtime half is gated on Phase 21 existing as a real project _and_ on
a per-game answer to "can this game's live match state even reach us."

**Open questions for the client (do not guess these):**

1. Trigger signal — kills specifically, or score/objective-based, or
   something else? Does it vary per game?
2. Stage count and thresholds — e.g. 3 fixed stages at kill counts
   0/5/10, or seller-configurable per listing?
3. Scope for v1 — is a _static_ multi-stage skin (buyer manually
   switches stages, no live automation) an acceptable first cut while
   Phase 21 doesn't exist yet, or is "reactive" specifically the point
   and a non-live version isn't worth shipping?
4. Which games are actually in scope — this needs each target game to
   expose live kill/score events through some API/mod hook KOBA can
   reach; that's a per-game feasibility question, not an engineering one.

---

## Phase 15 — KOBAads + Boost

Client has now named the original outline's "Phase 7 — KOBA Ads" as
**KOBAads**, and named a second, related spend mechanic: **Boost**. As of
2026-08-15 the client fully specified Boost's mechanic (below); KOBAads
itself (campaign targeting/budget/impression billing) remains open —
still blocked on Phase 8's ranking infrastructure per the dependency
note below, so **this phase's engineering work is scoped to Boost only**
for now. KOBAads stays planning-only until Phase 8 exists.

**Boost mechanic, per client direction (2026-08-15) — fully specified:**

- A Boost is a purchasable, **held item**, not a live ad campaign — it
  sits in the buyer's wallet (alongside Coins) until applied, the same
  "buy now, spend later" shape as Coins themselves.
- **Giftable**: a player can buy a Boost and give it to a favorite shop
  or influencer, who then applies it themselves — provenance (who gifted
  it) is tracked, not just current ownership.
- **Applicable to multiple target kinds**: a product, a shop, a group, a
  game server, or an influencer profile (expanded 2026-08-15 per client
  clarification — "a way for players to support their favorite shops,
  servers and influencers") — "or any supported feature," so the
  target-kind list is deliberately designed to extend (e.g. LFG posts,
  KOBAads units once Phase 15's ad model exists) without a schema
  rewrite.
- **Fixed effect**: 10-minute duration, 3x exposure multiplier. Not
  spend-until-exhausted — this resolves the phase's original open
  question in favor of the fixed-time-window model.
- **Surfaces**: shown right before a product's publish step (an upsell
  prompt) and as a visible indicator on boosted product cards while
  active.
- Distinct from KOBAads: no advertiser targeting/budget/impression
  billing model — a Boost is a flat, pre-priced, self-contained token.

**Scope, as engineering deliverables (this build)**

- `Boost` model: purchase (Coins), gift (ownership transfer with
  provenance), apply (to a product/shop/group the applier owns/manages),
  lazy expiry (no cron needed — computed at read time from
  `appliedAt + 10min`).
- Enforcement wired at the marketplace product listing surface as the
  first real target kind (sort priority + card badge) — shop/group
  listing surfaces follow the same `isBoostActive`/multiplier lookup but
  aren't wired into their own sort/badge UI in this pass.
- KOBAads (KCU ad units, campaigns, impression/click billing) is
  **not** part of this build — still blocked on Phase 8, and its own
  targeting/budget mechanics haven't been specified the way Boost's now
  are. Building it under a guessed budget/targeting model would repeat
  the mistake this ROADMAP explicitly tries to avoid elsewhere (see
  TDLS, Phase 16's multiplier perk).

**Data models / entities**

- `Boost` (ownerUserId, status [UNUSED/APPLIED/EXPIRED], purchaseCoinCost,
  giftedFromUserId?, targetType?, targetId?, appliedAt?, expiresAt?) —
  follows the `AuditLog.targetType`/`targetId` string-pair convention
  already used in this codebase for polymorphic references, rather than
  three nullable FK columns.
- `Ad` / `AdCampaign`, `AdImpressionLog`, `AdClickLog` — still planning
  only, unchanged from before, blocked on Phase 8 + a KOBAads targeting/
  budget spec.

### KOBAads ranking algorithm — design spec (2026-08-15, not yet buildable)

Feed Engine (Phase 8) now exists for real (`features/social/lib/
feed-ranking.ts`), so the piece that was actually missing before —
somewhere to interleave ads _into_ — is done. What's still missing is
the `Ad`/`AdCampaign` data model itself (targeting/budget/creative), so
this is a **ranking algorithm design**, grounded in how real ad auctions
work (Google/Meta-style generalized second-price auctions with a quality
multiplier — an ad wins the slot on total value, not raw bid), not an
implementation — there's nothing to wire it to yet.

**Total value formula per candidate ad, per slot:**

```
totalValue = bid × predictedCTR × qualityScore × boostMultiplier
```

- `bid` — advertiser's price per impression (KOBA Coins), set at
  campaign creation — the one input this design doesn't get to invent,
  it's a real business/pricing decision (self-serve minimum bid, auction
  vs. fixed-price placement) for whoever specs the campaign model.
- `predictedCTR` — reuses the _same_ relevance signals
  `computePostScore` already computes for organic ranking (following,
  group membership, shop-follow relevance), plus the ad's own
  historical CTR once it has impression data — cold-start ads (no
  history yet) get a neutral prior rather than being ranked to zero or
  guessed at.
- `qualityScore` — penalizes ads with a high report/hide rate (reusing
  the existing `ContentReport`/moderation signals Phase 8's organic
  ranking already respects) so a low-quality ad can't just outbid its
  way to a slot regardless of how badly viewers respond to it.
- `boostMultiplier` — **this is where Boost and KOBAads become one
  algorithm, not two bolted-together systems**, per the client's own
  framing of Boost ("similar to koba ads... pushing their product 3x to
  the koba algorithm"): a Boosted ad's `totalValue` is multiplied by
  `BOOST_MULTIPLIER` (3x, `features/boost/lib/pricing.ts`) exactly like
  a Boosted group's posts already get in organic ranking today.

**Delivery mechanics (industry-standard, not KOBA-specific research):**

- **Pacing**: spend each campaign's budget on a throttled curve across
  its flight window (a simple proportional throttle — behind pace, win
  more slots; ahead of pace, win fewer — is sufficient for v1; PID/MPC
  pacing controllers are a real refinement, not a v1 requirement).
- **Frequency capping**: cap distinct impressions of the same ad to the
  same viewer per day (e.g. 3/day, matching common industry practice) —
  same Redis-with-in-memory-fallback shape as `features/social/lib/
feed-cache.ts` and `lib/security/rate-limit.ts` would work for this.
- **Interleaving cadence**: one ad slot per N organic posts (never two
  ads adjacent) rather than a fixed position, so the feed doesn't feel
  ad-heavy regardless of scroll speed.

**Still genuinely open** (business inputs this design can't supply):
minimum bid / self-serve vs. managed campaigns, targeting dimensions
advertisers can select (game, category, audience?), and creative format
constraints for a KCU. Once `Ad`/`AdCampaign` exists with those answered,
wiring this into `listFeed` is additive — an ad-candidate fetch +
scoring pass alongside the existing organic candidate pool, not a
rewrite of Phase 8's ranking.

**Dependencies**

- Coins ledger + reservation/capture (done) — Boost purchase reuses it
  directly.
- Feed Engine (Phase 8) — only blocks KOBAads, not Boost. Boost's
  product/shop/group targets don't need feed ranking infrastructure.

**Open questions for the client**

1. **Boost price** — not yet specified. A placeholder cost is in code
   (`features/boost/lib/pricing.ts`, clearly marked) so the feature is
   testable end-to-end; needs a real number before launch.
2. The "any type of native ad" / "any supported feature" phrasing —
   target-kind list expanded 2026-08-15 to product, shop, group, server,
   and influencer profile (client clarification). KCU ad units
   themselves can't be a Boost target until Phase 15's `Ad`/`AdCampaign`
   model exists — same blocker as item 3.
3. KOBAads campaign targeting/budget model — the _ranking algorithm_ is
   now specified (see "KOBAads ranking algorithm" above); the data model
   itself (bid amount, targeting dimensions, self-serve vs. managed) is
   still fully open.

---

## Phase 16 — KOBA Plus (subscriptions)

**Status: real Stripe Subscriptions shipped (2026-08-15), single tier
$4.99/month (client-confirmed), replacing the previous `/plus` UI shell**
(a fake "checkout handoff" that never charged anyone — `startCheckoutHandoff`
literally commented "No Stripe charge... without activating"). Tenure
badges and per-server bio are real, live perks. Everything else listed
below as a perk is either deliberately deferred (client said so this
turn) or blocked on a prerequisite feature that doesn't exist at all
(not just unwired) — see "What's real" / "Deferred" below.

A recurring paid subscription tier — subscription-style profile/shop
customization and platform perks, not gameplay advantages.

**What's real:**

- Real Stripe Checkout in `mode: "subscription"`
  (`features/plus/services/plus.service.ts`), webhook-driven state sync
  (`customer.subscription.created/updated/deleted` —
  `features/payments/services/webhook.service.ts`). `invoice.payment_failed`
  deliberately has no separate handler: Stripe already transitions the
  subscription to `past_due` on a failed invoice, which fires
  `subscription.updated` and lands the same state via the existing
  mapping — a dedicated handler would just be a redundant second write.
- **Tenure badges**: `firstActivatedAt` set once, the first time a
  subscription becomes ACTIVE (deliberately never reset by a
  lapse-and-resubscribe — the more generous, standard choice, still
  flagged for confirmation, see open questions). Four tiers
  (Bronze/Silver/Gold/Diamond) at 0/3/6/12 months
  (`features/plus/lib/tenure.ts`) — thresholds are a placeholder, not
  client-specified, same convention as Boost's placeholder price.
  Rendered on the public profile page.
- **Per-server bio** (`ServerBio` model): gated to `state === "ACTIVE"`
  at the service layer (`setServerBio`), public to read, Plus-only to
  write. Wired into `/servers/[serverId]`.
- **Cancel is at period end, not immediate** — Plus perks stay active
  through what's already been paid for. A deliberate default (matches
  standard subscription-product behavior), not a guess left unflagged —
  see open questions.

**Deferred, per client direction this turn (2026-08-15) — not silently
dropped:**

- The multiplier/boost perk — explicitly held out of this build; add
  once its target mechanic is specified.

**Blocked on a prerequisite that doesn't exist at all, not just
unwired:**

- **Animated avatar & profile banner** — there is no avatar/banner
  upload feature for _any_ account today (only `User.image`, a static
  OAuth-provider URL, no banner field anywhere). Gating the _animated_
  variant of a feature that doesn't exist yet has nothing to attach to.
- **Custom themes, app icons, notification sounds** — no theming system
  exists anywhere in this codebase.
- **KOBA Shop member discount / Cosmetic sub-type access** — both
  correctly blocked on Phase 23 (KOBA Shop), which doesn't exist yet.

**Perks, per client direction (2026-08-15):**

- Profile badges that evolve with tenure (longer subscription = higher
  badge tier).
- Animated avatars and animated profile banners.
- A per-server bio (a bio that can differ per game-server community,
  distinct from the account-wide profile bio).
- Custom app themes, app icons, and notification sounds.
- Member discounts on KOBA Shop cosmetic purchases (see Phase 23 —
  distinct from the existing Blue-Badge marketplace commission discount,
  which is a seller-side rate, not a buyer-side discount).
- A multiplier/boost-style perk on some existing platform mechanic — the
  client referenced this only by comparison to a similar mechanic on
  another platform; the exact KOBA mechanic it multiplies and by how much
  is **not yet specified** (see open questions below — deliberately not
  guessing a name or number for this one).
- Access to the four Cosmetic sub-types beyond what's purchasable
  standalone: nameplates, avatar decorations, profile effects, and
  profile frames (`Cosmetic` model, `features/marketplace/lib/
game-policy.ts` confirms these are never game-gated — see Phase 3).

Cosmetics themselves are always purchasable with real money (USD) via the
KOBA Shop independent of a Plus subscription (Phase 23) — Plus's cosmetic
perk is the animated/tenure-badge/discount layer on top, not a paywall on
the base cosmetics themselves.

**Scope, as engineering deliverables**

- Real Stripe **Subscriptions** — a materially different Stripe surface
  than anything built so far in this codebase. Every payment flow shipped
  to date (`features/payments/**`, live Coin purchases) is a one-off
  Stripe Checkout Session; subscriptions need recurring billing, a
  different webhook event set (`customer.subscription.created/updated/
deleted`, `invoice.paid`, `invoice.payment_failed`), and a plan/tier
  concept that doesn't exist anywhere yet.
- Perk enforcement points, once built: profile rendering (badge tier,
  animated avatar/banner, theme/icon/sound), per-server bio storage and
  display, KOBA Shop checkout (member discount rate), and whatever the
  still-unspecified multiplier perk turns out to gate.

**Data models / entities**

- `PlusSubscription` — pre-existing scaffolding (from earlier "owner
  expansion backends" work), extended rather than replaced with a new
  `UserSubscription` model: added `stripeCustomerId`,
  `stripeSubscriptionId`, `cancelAtPeriodEnd`, `firstActivatedAt`.
  `renewsAt` (pre-existing) doubles as `currentPeriodEnd`. No separate
  `SubscriptionPlan` table — single tier is an in-code constant
  (`features/plus/lib/types.ts`), same "known simplification" convention
  as `coin-packages.ts`; add a real plan table if/when a second tier
  ships.
- `ServerBio` (userId, gameServerId, bio) — new, for the per-server bio
  perk; `AccountProfile.bio` remains account-wide only.
- `firstActivatedAt` is the tenure clock, not `createdAt` —
  `PlusSubscription` rows are upserted eagerly on first `/plus` page
  visit (state `NONE`), so `createdAt` means "first viewed the page," not
  "first paid."

**Dependencies**

- Stripe integration patterns already established (`features/payments/
lib/stripe.ts`, webhook signature verification) extended for real —
  subscription mode Checkout + a new webhook event set, not a
  copy-paste of checkout.service.ts.
- Phase 23 (KOBA Shop) for the member-discount perk to have something to
  discount — still blocking, unchanged.

**Open questions for the client**

1. The multiplier/boost perk — what platform mechanic does it apply to,
   and what's the multiplier value? (Deliberately deferred out of this
   build per client direction 2026-08-15, not guessed.)
2. Tenure badge thresholds (0/3/6/12 months, Bronze/Silver/Gold/Diamond)
   — a placeholder, not client-specified; confirm or retune.
3. Does tenure progress reset on a lapse-and-resubscribe, or persist?
   Shipped assuming persist (the more generous default) — needs
   confirmation, not just a coded assumption.
4. Member discount rate on KOBA Shop cosmetics — flat percentage, or
   tiered? Still blocked on Phase 23 existing at all.

---

## Phase 17 — Game Server Directory + Live RCON

**Status: shipped (2026-08-15) for PC (Rust, Garry's Mod) AND Rust
Console Edition** (Xbox/PlayStation) — the console gap this section
originally flagged as blocked on an unpicked hosting-provider API was
closed within the same day: real research found Rust ships an official
second RCON transport, WebRcon, that GPORTAL's own documentation
confirms works for Console Edition too. `testRconConnection` was a
stub — it only checked whether `host`/`port` were truthy, never opened
a real connection — now real for every case below.

**What's real:**

- **Real Source RCON protocol client**
  (`features/servers/lib/rcon/source-rcon.ts`): TCP,
  SERVERDATA_AUTH/EXECCOMMAND/RESPONSE_VALUE per Valve's public protocol
  spec, for PC Garry's Mod (and PC Rust servers that haven't enabled
  the newer transport below).
- **Real Facepunch WebRcon client**
  (`features/servers/lib/rcon/rust-webrcon.ts`): WebSocket, JSON
  messages (`{"Message", "Identifier"}` request /
  `{"Message", "Identifier", "Type", "stacktrace"}` response,
  `ws://host:port/password` — the password is the URL path, not a
  separate auth step). This is Rust's _own_ official second RCON
  transport (`github.com/Facepunch/webrcon`, open source) — and per
  **GPORTAL's own wiki** (not inferred, their documented instructions
  for RUST CE admins), it's also how Console Edition is RCON'd into.
  Wired as Rust's primary RCON protocol on both PC and CONSOLE.
- **Live stats on Rust Console Edition — resolved same day.** A2S_INFO
  (UDP query) reachability on console is still unconfirmed, but that
  turned out not to matter: `status` and `playerlist` are normal RCON
  commands, reachable via the same WebRcon connection already
  confirmed working on Console Edition — no separate protocol needed.
  `playerlist` (`features/servers/lib/rcon/rust-webrcon.ts`) returns a
  real structured JSON array (verified against a concrete published
  example — SteamID/DisplayName/Ping/etc. per player), used as the
  primary player-count source since counting array entries needs no
  text-format guessing. `status` (regex-parsed text, lower confidence,
  documented as such in code) supplies hostname/map/max-players, the
  fields `playerlist` doesn't carry. Both queried in parallel; a
  failure in one doesn't block the other.
- **Real A2S_INFO query client**
  (`features/servers/lib/rcon/source-query.ts`): UDP, PC Source-engine
  servers only (Rust, Garry's Mod) — the _correct_, highest-confidence
  protocol for public live-stats reads on PC; RCON itself is for
  authenticated admin commands, a different concern. Implements the
  challenge/response round trip modern Source servers require. Tried
  first when available; the RCON-based path above is the fallback for
  servers A2S doesn't reach (Console Edition today).
- **Polling model (client-confirmed 2026-08-15)**: on-demand, cached
  ~45s (`features/servers/lib/status-cache.ts`, same fail-soft Upstash/
  in-memory shape as `feed-cache.ts`/`rate-limit.ts`) — queried when a
  server's page is viewed, not a scheduled sweep of every registered
  server, no persistent connections.
- **Server "rarity" (client-clarified 2026-08-15)**: derived from a Map
  the owner purchased on the KOBA marketplace and marked active on that
  server (`GameServer.activeMapInventoryItemId`) — not a standalone
  field the owner sets directly. Owner-facing picker on
  `/servers/[serverId]`.
- **Real gap found and fixed while wiring rarity**: `fulfillOrder`
  (`features/payments/services/checkout.service.ts`) never actually
  created an `InventoryItem` for the buyer — `InventoryAcquisitionSource
.PURCHASE` existed in the schema clearly anticipating this, but
  nothing called it. Without this fix, Phase 19's "done" rarity-matched
  trading could only ever operate on seeded/admin-granted items, never
  anything a buyer actually bought — and server rarity would have had
  nothing real to derive from. Now every unit purchased grants a real,
  tradeable `InventoryItem`.

**Still not covered — genuinely, not just unwired:**

- Games without a known adapter (Minecraft, DayZ, everything else in
  the catalog besides Rust/Garry's Mod) — fails closed, never faked.
  Extending this is adding one registry entry once a real protocol is
  confirmed for that game, not new architecture.
- Console Garry's Mod (no equivalent to WebRcon confirmed for it — it's
  Facepunch/Rust-specific tech).
- `status`'s text format is regex-parsed against the widely-documented
  shape, not a byte-verified spec the way `playerlist`'s JSON and
  A2S_INFO's binary format both are — flagged as lower-confidence in
  code, fails closed (null fields) rather than guessing on a mismatch.

**Dependencies**

- Shop (done) — servers already link to an owning shop.
- `ServerCapability`/`ServerOnlineStatus`/`RconTestState` enums (done).
- `InventoryItem` + real purchase-to-inventory linkage (done, this
  phase's fix) — server rarity depends on it.

**Open questions for the client**

1. Beyond Rust/Garry's Mod, which other PC games need RCON support, and
   what protocol do they actually use (confirm before assuming Source
   RCON applies — it doesn't universally).

---

## Phase 18 — Freebie Products (status: done)

Sellers can mark a product free — **permanently**, or **for a fixed
initial quantity** (e.g. "first 15 free," then it reverts to its normal
paid price). Surfaced via a "Freebies only" filter on `/market`.

**Scope, as engineering deliverables**

- Extend `Product` with a freebie policy: none / permanent / limited-
  quantity-then-paid, plus a remaining-free-quantity counter.
- Claim path: a **separate flow from paid checkout** — a $0 Stripe
  Checkout Session is possible but wasteful for a $0 transaction; prefer
  a direct claim endpoint that creates a `FULFILLED` `Order` at
  `totalCents: 0` without touching Stripe at all.
- Concurrency: decrementing the free-quantity counter needs the same
  care as auction bidding / inventory decrement already built (atomic,
  can't go negative under concurrent claims) — reuse that established
  pattern, don't reinvent it.
- One-claim-per-buyer enforcement (don't let a buyer claim the same
  freebie twice, even across quantity-reset edge cases).

**Data models / entities**

- Extend `Product`: `freebiePolicy` (`NONE` | `PERMANENT` |
  `LIMITED_QUANTITY`), `freebieQuantityRemaining` (nullable Int,
  meaningful only for `LIMITED_QUANTITY`).
- `Order.totalCents = 0` is already a representable state in the existing
  `Order` model — no new order-side model needed, just the $0 claim path
  above bypassing Stripe.

**Dependencies**

- Product / Order (done) — additive only.

**Resolved (shipped this way, revisit if the client wants different behavior)**

1. No auto-replenish. `freebieQuantityRemaining` is a one-time lifetime
   pool per product; a seller re-stocks it by editing the listing (the
   edit form's freebie-quantity field resets the counter to whatever's
   submitted, rather than diffing against prior claims).
2. Claims flow through the same `Order`/`FreebieClaim`/`InventoryItem`
   pipeline as a paid purchase (`fulfillOrder`'s inventory-grant path,
   reused via `grantInventoryForOrderItems`), so they show up in the
   same order history and analytics as paid orders — just at
   `totalCents: 0` and `status: FULFILLED` immediately, no Stripe
   round-trip.

**What shipped**

- `Product.freebiePolicy` (`NONE` | `PERMANENT` | `LIMITED_QUANTITY`) +
  `freebieQuantityRemaining`; `FreebieClaim` (unique per
  product+buyer, unique per order) enforces one-claim-per-buyer.
- `claimFreebie` (`features/payments/services/checkout.service.ts`):
  atomic decrement + `Order` + `FreebieClaim` + `InventoryItem` grant
  in one transaction, gated behind `MARKETPLACE_CHECKOUT`, fail-closed
  on self-buy / sold-out / already-claimed / non-freebie listing.
- `POST /api/market/products/[slug]/claim-freebie`, rate-limited.
- Seller create/edit form gained a freebie-policy select + quantity
  field; `/market` gained a "Freebies only" filter, a Free badge on
  product cards, and a Claim button on the product detail page that
  replaces the checkout button for freebie listings.

---

## Phase 19 — Rarity-Matched Trading (status: done)

**This phase is already built** — flagged here only so it's tracked
alongside the rest of this document, not because it's outstanding work.

Client rule: only items of the **same rarity tier** may be traded against
each other (fairness constraint). Confirmed live in
`features/trade/lib/rarity-policy.ts#assertSameRarityTrade`, enforced by
the trade offer/accept flow shipped with item trading.

**Correction (2026-08-15, found while building Phase 17):** the trading
_rule_ was always real, but until Phase 17's `fulfillOrder` fix, nothing
ever populated `InventoryItem` from an actual marketplace purchase —
`InventoryAcquisitionSource.PURCHASE` existed in the schema but no code
path used it. This phase's trading logic only ever had seeded/admin-
granted items to operate on in practice. Now fixed — "no gap" is
accurate again, but wasn't quite true between when this phase first
shipped and Phase 17's fix.

---

## Phase 20 — Multi-Subdomain Architecture (status: MVP done)

**Option 1 (middleware-based rewrite) is shipped** —
`lib/subdomain-routes.ts` + `middleware.ts` (2026-08-17). A request
arriving on `developer.koba.games`, `app.koba.games`, `admin.koba.games`,
or `aiden.koba.games` is served from the matching existing route
(`/developers`, `/apps`, `/admin`, `/aiden`) via `NextResponse.rewrite` —
same deployment, same database connection, no new infra. `/api/*` is
never subdomain-prefixed (all subdomains share one backend); unrecognized
hosts (bare `koba.games`, localhost, preview deploys, `staging.koba.games`,
etc.) pass through untouched. Auth redirects (`/login`, `/login/mfa`,
`/kobaid`, `/enter`) issued from a subdomain-rewritten request target the
canonical apex host (`koba.games`), not the subdomain, since those pages
aren't themselves subdomain-mapped — verified `admin.koba.games/` → `307`
to `koba.games/login?callbackUrl=%2Fadmin`.

**Correction (2026-08-17)**: `app.koba.games` originally mapped to
`/developers/apps` per this section's own table below — that path turned
out to be the *developer's own* app-management dashboard (submit for
review, revoke), not the public storefront. The real public catalog was
already `/apps` (the marketplace's "Browse apps" link, confirmed via
`grep`, already pointed there). Fixed to map `app` → `/apps`.

**Deployment note**: verified end-to-end against a real production build
(`next start`), not just `next dev`. Locally, testing on a non-default
port *without* `X-Forwarded-Host`/`X-Forwarded-Port` headers makes
Next.js's internal rewrite loopback fail (it falls back to assuming port
3000) — this is a `next start` self-hosting quirk, not a bug in the
rewrite logic itself, and disappears once those headers are present
(confirmed by testing with them set). Any reverse proxy in front of the
real deployment (nginx, Caddy, the hosting platform's own edge) sets
these by default, so this needs no application-level workaround — just
confirm whatever fronts `koba.games` in production does set them (it's
standard behavior, but worth a smoke test after the real domain is live).

**Still open, per below**: `admin.koba.games` as a genuinely separate
deployment (option 2) for its own security perimeter, and DNS/TLS
ownership for the actual `koba.games` zone — this MVP works the instant
DNS points those subdomains at this same deployment; it does not by
itself provision or manage that DNS.

Client-specified domain structure:

| Subdomain              | Purpose                        | Current state                          |
| ---------------------- | ------------------------------ | -------------------------------------- |
| `koba.games`           | Main site                      | This app, path-based routing           |
| `developer.koba.games` | Developer portal               | Exists at `/developers` (mock/UI-only) |
| `app.koba.games`       | App store                      | Real storefront at `/apps` (2026-08-17) |
| `admin.koba.games`     | Staff admin backend login      | Exists at `/admin`                     |
| `aiden.koba.games`     | AI generation suite (Phase 14) | Exists at `/aiden` (UI shell)          |

**Scope, as engineering deliverables**

- This is an infra/routing decision, not a feature — two real options:
  1. **Middleware-based subdomain rewrite within the same deployment**:
     Next.js middleware inspects the `Host` header and rewrites e.g.
     `developer.koba.games/*` to the existing `/developers/*` route
     internally. Least work, single deployment, single database
     connection — probably the right MVP choice for most of these.
  2. **Genuinely separate deployments/apps** sharing the same database,
     talking over internal APIs. More isolation — likely worth it
     specifically for `admin.koba.games`, given it's the highest-
     privilege surface in the whole system and benefits from a separate
     security perimeter (different deploy pipeline, stricter network
     access, no shared client-side bundle with the public app).
- Should land _after_ the routes it's exposing have real functionality
  (Phase 9 Developer Portal, Phase 14 Aiden) — doing this first is just
  infra churn on stub pages with nothing behind them yet.
- **`aiden.koba.games` cross-domain login** ("Login with KOBA" button
  that auto-detects and validates the user's KOBAID): only meaningful
  once Aiden is a genuinely separate host from the main app — today
  they're the same Next.js app/session, so there's nothing to bridge yet
  (a signed-in user on `/aiden/*` is already the same session as
  `koba.games`). Once split (either option above), this becomes a real
  SSO flow: `aiden.koba.games` redirects to `koba.games`'s existing
  Auth.js session, KOBA validates and hands back a signed token/cookie
  scoped to the Aiden host. Do not build a fake/local version of this
  before the real split exists — it would just be thrown away.
- **Shared wallet, already true today**: KOBA Coins (`CoinWallet` and the
  rest of the ledger) already live in one database used by the whole app,
  including Aiden's Coin reservations
  (`features/wallet/services/ledger.service.ts`). Splitting Aiden onto
  its own host does not require a wallet migration either way — both
  options above keep one shared database; this is only a routing/hosting
  change, not a data-ownership change.
- **Aiden access control**: a Business KOBAID is required to use any
  Aiden tool — already enforced today
  (`features/aiden/lib/require-business.ts`, gating every `/aiden/*` page
  and `/api/aiden/*` route, same pattern as `/business`'s gate). This
  carries over unchanged once Aiden moves to its own subdomain.

**Dependencies**

- Soft dependency on Phase 9 (Developer Portal), Phase 14 (Aiden) —
  sequence after, not before, so the subdomain split has real
  functionality to expose.

**Open questions for the client**

1. Single-deployment subdomain rewrite (option 1) vs. genuinely separate
   apps (option 2) — cost/complexity/isolation tradeoff, especially
   whether `admin.koba.games` specifically warrants its own deployment
   regardless of what's chosen for the others.
2. DNS/TLS ownership — who manages the `koba.games` zone and subdomain
   records (affects whether this can be done from within the app repo
   at all, or needs coordination outside it)?

---

## Phase 21 — KOBA PC Plugin

A native desktop application — **not part of this Next.js app**, a
separate codebase/tech stack — that talks to `koba.games` and
`aiden.koba.games`, confirms the player's KOBAID + linked Steam account,
and lets them apply skins they bought or Aiden-generated directly into
their games.

**Free to use** — no KOBA Plus / paywall gate, confirmed by the client.
Distributed via the Business dashboard (`/business`): a download link,
surfaced once the plugin actually exists — do not build a placeholder
download card pointing at nothing.

**Foundational gap this phase (and Phase 22) both depend on**: this app
currently has **no authentication mechanism for a non-browser client** —
Auth.js sessions are browser cookies only. A desktop plugin (and, below,
a Discord bot) both need an OAuth2 device-authorization-style flow
(user gets a code/link, approves in their browser, the client polls for a
token) — this is new infrastructure, shared by both phases, built once.

**Scope, as engineering deliverables**

- **Backend (this repo)**: a device-authorization endpoint set
  (`POST /api/oauth/device/code`, `POST /api/oauth/device/token`,
  a consent page at `/oauth/authorize`) issuing scoped access tokens for
  non-browser clients. `SteamAccountLink` (userId, steamId64, linkedAt) —
  Steam's own OpenID login, not a koba-issued credential, so this is a
  "confirm the player owns this Steam account" flow, not a password.
  A read API for the plugin: the player's `InventoryItem` rows (already
  exists, from item trading) filtered to purchased/Aiden-generated skins.
- **Plugin (separate project)**: device-flow login, Steam account
  detection/confirmation, fetches owned skins, and **applies** them —
  this last part is genuinely game-specific and is not one integration:
  for games with a workshop-style skin system this likely means writing
  to that game's local skin-config, for Aiden-generated custom content it
  means placing the generated files into the correct local game/mod
  directory. This mirrors Phase 17's "per-game adapter" problem — expect
  a similar per-game applicator architecture, not a single universal one.

**Data models / entities**

- `SteamAccountLink` (userId unique, steamId64 unique, linkedAt).
- `OAuthDeviceGrant` / `OAuthAccessToken` (device code, user code, scopes,
  expiry, associated userId once approved) — new, shared with Phase 22.
- Extend `InventoryItem` with an apply-status field (e.g. `appliedAt`,
  `appliedGame`) so the plugin can report back what it actually applied,
  distinct from what's merely owned.

**Dependencies**

- `InventoryItem` (done, from item trading).
- Aiden generation (pipeline done, no vendor wired — Phase 14).
- New: OAuth device-flow infra (shared with Phase 22).

**Open questions for the client**

1. Plugin tech stack — Tauri/Electron/native. Real tradeoffs: install
   size, cross-platform story, and how easily it can read/write into
   arbitrary game install directories.
2. Code-signing and distribution channel — this is an installed native
   app with local filesystem write access to game directories; trust and
   security expectations are materially different from a web app.
3. Per-game skin-application mechanics and launch game list — this is
   the actual hard part and needs to be scoped per game, not assumed
   universal.

---

## Phase 22 — Discord Bot

Live feeds from `koba.games` (group feeds, marketplace feeds) posted into
Discord, plus account linking and in-game item delivery via slash
commands.

**Architecturally, KOBA plays the role Tip4Serv plays for KAOSBOT/
Ch33kys/Veretech** (client framing, 2026-08-16) — a webshop whose
purchases trigger RCON-based item delivery — except KOBA is both the
storefront _and_ the delivery bot (KOBAbot), not a webshop handing off
to a separate third-party bot. Same delivery mechanism (RCON), no
external dependency.

**Free to use** — no KOBA Plus / paywall gate, same as the PC plugin.
Distributed via the Business dashboard (`/business`): a bot-invite link,
surfaced once the bot actually exists.

**Scope, as engineering deliverables**

- **Account linking**: a slash command (e.g. `/link`) — if the Discord
  user has no linked KOBAID, show a button that starts the same OAuth
  device-flow consent from Phase 21 (shared infra, not a second auth
  system), ending with a "Create account" path if they don't have a
  KOBAID yet. Once linked, prompts for console platform — Xbox
  (gamertag) or PlayStation (PSN username).
- **Live feeds**: Discord channel subscriptions to a KOBA group's feed or
  the marketplace feed, pushed via Discord webhooks on relevant events
  (new post, new listing). Phase 8's real ranked Feed Engine now exists
  (shipped 2026-08-15) — a Discord push could ride the same ranking, or
  stay simple "new item posted" event-driven pushes; that's a product
  choice, not an engineering blocker either way.
- **Item delivery**: once a purchase completes, the bot delivers the
  in-game item. For server-deliverable items this should reuse Phase 17's
  RCON infrastructure (the bot triggers a give-item RCON command against
  the buyer's linked server account); for client-side skins this
  coordinates with the Phase 21 plugin instead — the bot itself doesn't
  reach into a player's PC.
  **Groundwork shipped (2026-08-16):** the actual `kit` Oxide/uMod
  console-command syntax (real, multi-sourced admin docs — Reddit
  r/RustConsole, GameServerKings' Rust kits guide, the Rust Console
  Edition community-servers GitBook), a pure command-string builder
  for it, and a `giveKitToPlayer` service primitive that runs
  `kit givetoplayer "[kit]" "[gamertag]"` over whichever RCON transport
  `rconProtocolForGame` picks (`features/servers/lib/rcon/kit-commands.ts`,
  wired into `features/servers/services/server.service.ts` and
  `POST /api/servers/[serverId]/kits/give`). Not yet wired to order
  fulfillment — that still needs the Discord account-linking flow
  (gamertag capture) described above, which doesn't exist yet. KOBA
  doesn't create kits; server owners set those up in-panel themselves,
  same as they would for KAOSBOT/Ch33kys/Veretech.
- **Third-party delivery bot interop (deferred, client decision
  2026-08-16): for now, console kit/in-game-item delivery goes through
  KOBAbot only.** A server owner already running a different console
  delivery bot — e.g. **KAOSBOT** (bot.ka0s.uk), **Ch33kys RCE Bot**
  (ch33kysrcebot.com), or **Veretech** (docs.tip4serv.com), all real,
  verified via web search 2026-08-16, all already deliver purchased
  items via RCON when notified by a webshop like Tip4Serv — is **not**
  in scope right now. If the client revisits this, the likely-correct
  shape is an outbound per-order webhook a server owner can point at
  whichever bot they run, but building that still needs the actual
  Tip4Serv/KAOSBOT/Ch33kys/Veretech incoming-webhook contract (payload
  shape, auth) confirmed from their own docs first — not guessed.
- **This is a separate always-on service**, not a Next.js route — a
  Discord gateway connection needs its own long-running process and
  hosting decision, run alongside but not inside this web app.

**Data models / entities**

- `DiscordAccountLink` (discordUserId unique, userId, linkedAt).
- `XboxAccountLink` (userId, gamertag) / `PlayStationAccountLink` (userId,
  psnUsername) — self-reported at MVP; see open question below on
  whether real Xbox Live/PSN API verification is even reachable.
- `DiscordChannelSubscription` (guildId, channelId, feedType [GROUP |
  MARKETPLACE], feedRef, webhookUrl).

**Dependencies**

- New: OAuth device-flow infra (shared with Phase 21).
- `InventoryItem` (done), RCON (Phase 17, not yet real — item delivery
  to servers is blocked on this).
- Groups/Social feeds (done, basic reverse-chron only).

**Open questions for the client**

1. Bot hosting — where does this always-on process run (separate from
   the Next.js deployment)?
2. Real Xbox Live / PlayStation Network API verification of
   gamertag/PSN username requires a publisher partnership agreement with
   Microsoft/Sony respectively — this is a business/legal step, not just
   engineering. Is self-reported (unverified) good enough for MVP, or is
   real verification a hard requirement before launch?
3. Which feeds are in scope for v1 — group feeds and marketplace feeds
   are named explicitly; anything else (social posts, auctions ending)?
4. Rate limits / bot permission scope for the Discord application itself.

### Feature-parity request: Helios RCE (2026-08-15)

Client wants KOBAbot to match [heliosrce.com](https://www.heliosrce.com/)
— a mature, **Rust-specific** (their site says "Rust Console Server
Management") Discord bot. This is a large scope increase over the
original spec above (account linking + feed pushes + item delivery),
not a small addition. Capturing the full advertised feature list here
rather than guessing which parts matter for a v1:

- **Monitoring**: live killfeed with event triggers, player activity
  feed, raid alerts, a "command center" (players online, framerate,
  uptime, entity count).
- **Player systems**: teleport/home commands, zone management, auto-kits
  - automated kit distribution, custom command binds, spawn binds.
- **Economy & rewards**: an in-Discord shop, its own economy/currency
  system, a battle pass, random item drops.
- **Community**: clans, a bounty system, leaderboards/scoreboards, a
  support ticket panel.
- **Server management**: ZORP-style offline raid protection (configurable
  zones), timed commands, wipe countdowns, restart warnings, recurring
  automated messages.
- **Admin tooling**: a centralized dashboard, shared Discord-wide
  rules/permissions, per-module settings.
- **Misc tools**: a kit builder, a server-config "parse" generator, an
  in-game colored-text generator.

**Why this can't be scoped as "build it" yet:** almost every item above
needs one of two things that don't exist yet:

1. **Real, live RCON command execution against the player's actual
   server** — Phase 17 (this session) is building exactly this
   foundation (real Source RCON protocol client), so killfeed/teleport/
   kits/zones/timed-commands/raid-protection all become buildable _once
   Phase 17 ships_, not before. This is the single biggest unblock.
2. **A second economy layer** (shop, currency, battle pass, drops,
   bounties) that is either a Discord-local currency distinct from KOBA
   Coins, or literally KOBA Coins spent via Discord — a real product
   decision (two currencies confuses users; one currency needs the bot
   to talk to the same wallet ledger this app uses) that materially
   changes the design, not an implementation detail.

**Open questions for the client:**

1. Is this KOBAbot feature set Rust-specific (matching Helios RCE's own
   scope), or should it generalize to every game KOBA supports RCON for
   (Phase 17's launch list is currently Rust + Garry's Mod)?
2. Economy: a bot-local currency, or KOBA Coins spent through Discord?
3. Priority order — killfeed/monitoring first (closest to what Phase 17
   already provides), or the economy/community layer (clans, battle
   pass, bounties) which needs new infrastructure regardless of Phase 17?
4. Zone-based raid protection (ZORP) implies KOBA tracking spatial/base
   data per player per server — a new data model with no current
   equivalent anywhere in this codebase; confirm this is really wanted
   for v1 given the size of that alone.

---

## Phase 23 — KOBA Shop (cosmetics storefront)

A dedicated, high-exposure storefront for the universal `Cosmetic` model
(nameplates, avatar decorations, profile effects, profile frames, shop
banners, emoji — see Phase 3's Cosmetic-vs-Product distinction). Per
client direction (2026-08-15):

- **Homepage hero placement.** The KOBA Shop is featured in the homepage
  hero section, linking through to the full KOBA Shop catalog. This is
  materially more exposure than a standard shop's page — a design/product
  decision, not just a routing one (e.g. does every visitor see it, or is
  it personalized?).
- **Application-gated selling.** Only verified shops/accounts may apply
  to sell in the KOBA Shop specifically — this is a second, narrower gate
  on top of the existing Blue-Badge shop verification (Phase 9), not a
  replacement for it. A shop can be Blue-Badge verified and still not be
  approved to sell in the KOBA Shop.
- **Cosmetics only.** No `Product` listings (skins, maps, mods, server
  assets) — enforced the same way the `Cosmetic` model is already kept
  separate from `Product` (Phase 3 fix: Cosmetic is never game-gated,
  never tied to a `gameId`).
- **2.5% transaction fee**, charged to the seller — distinct from and in
  addition to the existing marketplace commission tiers
  (`KOBA_COMMISSION_BPS` 8% unverified / 4% verified in `.env.example`).
  This needs its own commission-resolution path since it doesn't vary by
  Blue-Badge status the way the marketplace fee does — it's a flat rate
  tied to the KOBA-Shop-approval gate, not the general verification gate.
- USD pricing throughout (cosmetics are never KOBA-Coin-priced — Phase 3
  fix already enforces this at the `Cosmetic` model level).

**Scope, as engineering deliverables**

- `KobaShopApplication` workflow — a shop applies, staff review/approve
  (likely reusing the admin queue pattern from Blue-Badge review, Phase
  9's `BlueBadgeReviewQueueEntry`), approved shops get a flag allowing
  their `Cosmetic` rows to appear in the KOBA Shop surface.
- KOBA Shop-specific commission resolution at Cosmetic checkout — a flat
  2.5% seller-side fee, separate code path from
  `resolveCommissionBps`/`splitPayment` in `features/payments/lib/
money.ts` (those are `Product`-order-shaped and Blue-Badge-tiered; this
  is `Cosmetic`-shaped and approval-gated, not tier-gated).
- Homepage hero section KOBA Shop entry point + a `/koba-shop` (or
  similar) full-catalog route, separate from the existing `/shops/[slug]`
  per-seller page and `/market` per-game marketplace.

**Data models / entities**

- `KobaShopApplication` (shopId, status: PENDING/APPROVED/REJECTED,
  reviewedByUserId, reviewedAt, note) — new.
- `Shop.kobaShopApproved: Boolean` (or derive from a live
  `KobaShopApplication` row with status APPROVED) — flags which shops'
  Cosmetic listings surface in the KOBA Shop.
- Cosmetic checkout/order model — needs confirming whether this reuses
  `Order`/`OrderItem` (currently `Product`-shaped, e.g. `inventoryQty`,
  `rarity`) or needs its own `CosmeticOrder`, since Cosmetic and Product
  differ enough (no rarity, no per-game inventory) that force-fitting
  Cosmetic into the existing Order model may need schema changes anyway.

**Dependencies**

- The Phase 3 Cosmetic-vs-Product fix (done — this phase would have been
  impossible to scope cleanly before that correction).
- Blue-Badge shop verification (Phase 9, done) as the base gate the KOBA
  Shop application sits on top of.
- Stripe Connect payout splitting (done, `features/payments/lib/
money.ts`) — extends to a new flat-rate commission path.

**Open questions for the client**

1. Cosmetic checkout — reuse `Order`/`OrderItem`, or a dedicated
   `CosmeticOrder` model? Affects whether existing order/escrow/refund
   UI needs branching logic or a parallel implementation.
2. KOBA Shop application review — same admin queue/SLA pattern as
   Blue-Badge review (Phase 9), or a different workflow?
3. Hero section behavior — always shown to every homepage visitor, or
   conditional (e.g. hidden once a user has already visited the KOBA
   Shop this session)?
4. Does KOBA Plus's member-discount perk (Phase 16) apply on top of the
   seller's listed price before or after the 2.5% seller fee is taken —
   i.e. does the discount cost the seller revenue or come out of KOBA's
   cut?

---

## Phase 24 — Achievement Badges (status: done)

Client spec (2026-08-16): "similar to the Discord-style badges that show
in the user's profile page, KOBA needs its own... use the 6-tier rarity
as well so each badge belongs to a rarity type, these badges are earned
never bought or sold, make yearly account age badges, and also come up
with achievements that unlock the badges, when a badge is unlocked, a
confetti animation, the harder to earn badges need animated effects."

**Data model** (`prisma/schema.prisma`): `Achievement` (catalog row —
slug/name/description/`ProductRarity`/`AchievementCategory`/lucide icon
name) + `UserAchievement` (grant join row, unique per user+achievement).
Reuses the exact six-tier marketplace rarity scale — and its crest
artwork (`public/brand/rarity/*.png`) — as the badge tier system, per
spec. No price field on either model: badges are earned only, never
purchased or gifted.

**Catalog** (`features/achievements/lib/catalog.ts`): 19 real, computable
achievements across 5 categories — `ACCOUNT_AGE` (yearly tenure badges:
1/2/3/5/10 years, Common→Relic), `TRADING` (first-trade, 10-trade
veteran, 50-trade master, Relic-item collector), `MARKETPLACE`
(shop-owner, first-sale, KOBA-verified shop, 50-sale storefront),
`COMMUNITY` (first comment, 25-post social butterfly, 50-follower
community favorite), and `SPECIAL` (active KOBA Plus member, 1-year Plus
veteran, and a Founding Member badge scoped to accounts created within
30 days of KOBA's real `20250814120000_init` migration date — not an
arbitrary cutoff).

**Service** (`features/achievements/services/achievement.service.ts`):
`syncAchievementCatalog()` idempotently upserts the catalog by slug (run
from `prisma/seed.ts`); `evaluateAndGrantAchievements(userId)` checks
every not-yet-held achievement's real criterion against live data (trade
counts, order counts, follower counts, etc.), grants any newly satisfied
ones, and writes an `ACHIEVEMENT_UNLOCKED` audit-chain entry per grant;
`listUserAchievements(userId)` returns what a user currently holds.

**UI**: `AchievementBadge` renders the rarity crest as the badge frame
with a small lucide-icon overlay tinted to the tier color (Legendary and
Relic tiers get an animated `filter: brightness/saturate` glow —
`animate-badge-glow` in `app/globals.css`, respecting
`prefers-reduced-motion`); `AchievementBadgeGrid` shows the full catalog
grouped by category on `/u/[handle]`, unlocked badges in full color and
not-yet-earned ones greyed out (Discord-style shelf, not hidden);
`AchievementConfetti` (client) fires a `canvas-confetti` burst — a bigger
one for Legendary/Relic unlocks — the moment a self-view page load grants
something new. Evaluation only runs on the profile owner's own page load
(`profile.isSelf`), not on every visitor view.

**Migration-history cleanup (prerequisite fix):** adding this phase's
migration surfaced pre-existing, real duplicate-statement bugs in the
migration history left by two independently-developed branches that had
each built overlapping features (KOBA Plus subscriptions, Aiden async
generation, shop promo/influencer config) under different migration
filenames, both merged into `main`. Fixed: duplicate `AuditAction` enum
values, a duplicate `ShopPromoConfig` table (recreated with different
column defaults by a later migration), a `PromoPayoutType` enum created
twice under the same name with different value sets (reconciled via
`ALTER TYPE ... RENAME VALUE` instead of a second `CREATE TYPE`), and a
duplicate foreign-key constraint. This wasn't just a shadow-database
quirk — it would have broken any genuinely fresh production install too.

---

## Sequencing / milestones

```
Phase 0  [DONE]  UI/UX design system
   |
Phase 1  KOBAID + Account Types              (foundation — must be first)
   |
Phase 2  Account Switching                   (depends only on 1)
   |
   +---------------------------+
   |                           |
Phase 3  Marketplace Core      |
   |                           |
   +--> Phase 4  Shops         |
   |                           |
   |                    Phase 5  Groups + LFG   (depends on 1, soft on 3)
   |                           |
   +---------------------------+
                |
        Phase 6  Social Layer (tagging)     (depends on 1, 2, 5)
                |
        Phase 7  KOBA Ads                   (depends on 3, 4, 5, 6)
                |
        Phase 8  Feed Engine                (depends on 1, 3, 5, 6, 7)
                |
   +------------+------------------+
   |                                |
Phase 9  Developer Portal      Phase 10  Influencer System
(depends on 2, 3, 4, 6, 11)    (depends on 1, 2, 3, 4)
   |                                |
   +------------+------------------+
                |
        Phase 11  Role System (RBAC)
        (depends on 1, 6 — can actually start
         early and run in parallel with 3-8,
         since it mostly touches staff/moderation,
         not marketplace/social; called out late
         here only because Phase 9's badge
         auto-removal needs it)
                |
        Phase 12  Database Schema            <-- integration checkpoint,
        (reconciles 1-11 in one sitting,          full context pasted once
         does not add new requirements)
                |
        Phase 13  API Routes
        (hard dependency on 12, per client instruction)
```

**Practical grouping for staffing/parallelization:**

1. **Serial, solo track first:** Phase 1 → Phase 2. Nothing else can start meaningfully before these (every later phase references KOBAID and/or mode-switching).
2. **Can run in parallel after Phase 2:** Phase 3 (Marketplace) and the groundwork of Phase 5 (Groups/LFG) don't depend on each other — a second developer/agent could take Groups+LFG while Marketplace Core is being built, provided both branch off Phase 2's capability-flag work.
3. **Phase 4 (Shops)** should follow Phase 3 directly (same person/thread ideally, since it's mostly "management UI over Phase 3's models").
4. **Phase 6 (Social layer)** is a natural join point — it needs Phase 5's group tag rules and Phase 2's mode-based tag rules, so schedule it after both land.
5. **Phase 7 (Ads) and Phase 8 (Feed)** are tightly coupled (KCU spec, then the engine that ranks KCUs) — treat as one continuous work block, in that order.
6. **Phase 9 (Dev Portal) and Phase 10 (Influencer)** are independent of each other and can run in parallel — different bounded contexts, both only need Phases 1-4 (+6 for Phase 9's fraud signals) as inputs.
7. **Phase 11 (RBAC)** has the fewest cross-dependencies of any phase after Phase 1 — it could be started as early as right after Phase 1 and developed in parallel with Phases 3-8 by a separate track, since it's mostly self-contained (staff roles, permissions, moderation actions) and only needs to _exist_ by the time Phase 9's badge auto-removal and Phase 12's integration land.
8. **Phase 12 is a hard serialization point** — do not start it until Phases 1-11 are functionally complete; it is explicitly scoped as a single-session, full-context integration pass, not an incremental migration process.
9. **Phase 13** starts only after Phase 12 is done.

---

## Design system — black/white, real dark/light toggle (2026-08-17)

Client: "the app store, koba.games, admin.koba.games, developer.koba.games
all need to follow the same color scheme...we need the toggle for dark
mode and light mode, lets forget the gradients, and use black and white
color scheme theme, icons should not have a border around them...the
logo needs to use the black and white color scheme same for the
favicon."

**A real toggle now exists** — `components/koba/theme-script.tsx` (inline,
blocking, runs before paint to avoid a flash of the wrong theme) +
`components/koba/theme-toggle.tsx` (the switcher, in `AppHeader`,
`DevPortalShell`, and the App Store header — one shared preference, not
per-surface). Persists to `localStorage` + a `koba-theme` cookie so
`app/layout.tsx` can render the right `data-theme` on the very first
server response too, not just after client hydration.

**Token-level, not file-by-file**: `app/globals.css`'s `@theme` block
(dark defaults) + a `:root[data-theme="light"]` override carry the whole
repaint — every existing `text-neon-lime`/`bg-neon-lime`/etc. class
across the app keeps its name, only the color VALUES moved to grayscale.
`bg-brand-gradient`/`text-brand-gradient` are flat `--color-foreground`
fills now, not gradients. Rarity/tier colors (common→relic) moved from a
hue ramp to a lightness ramp (common closest to the page background,
relic at maximum contrast) — same escalating-rarity logic, colorblind-
safe by construction now instead of by accident.

**Kept real hue on purpose**: destructive/warning/success (red/amber/
green) — these are functional state colors (a failed payment, a
dangerous action), not brand decoration; making an error visually
indistinguishable from a success would be a real usability regression,
not a style choice. Flag if this reading is wrong and full grayscale
(including error states) is actually wanted.

**Fixed this pass**: the KOBA wing logo (`components/koba/brand-mark.tsx`)
now renders via a `currentColor` CSS mask (same technique as
`koba-plus-mark.tsx`) instead of the raw always-orange PNG, so it
repaints with the toggle. Every direct `<Image src="/brand/koba-logo.png">`
usage found this pass was switched to `<BrandMark>` (developer hub,
App Store header, dev portal shell, marketplace product-card footer).
Favicon/PWA icons (`scripts/generate-pwa-icons.mjs`) regenerated as
white-on-black (static icons can't follow a live toggle, so one fixed
monochrome rendering replaces the old always-orange one — re-run the
script if the source logo ever changes). `IconRail`'s circular icon-pill
background was removed — flat icons only, matching the icon-border rule
already applied elsewhere in the app.

**Known remaining scope** (not touched this pass — flagged, not silently
skipped): roughly a dozen files still have their own hand-coded inline
gradients/colors rather than going through the token system —
`features/achievements/components/badge-frame.tsx` (coin tier gradients),
`features/marketplace/components/product-card.tsx` and `market-feed-
slide.tsx` (rarity-tinted card treatments, explicitly pixel-matched to a
client reference earlier — needs its own careful pass, not a rushed
one), `features/shops/components/shop-rarity-distribution-card.tsx`,
`features/social/components/profile-hero.tsx`, `components/koba/app-
sidebar.tsx`, `components/ui/button.tsx`, and a few more. The
architecture (toggle + token system) now covers the platform by default;
these specific files need individual attention in a follow-up pass since
they don't read from the shared tokens yet.

---

## Verified social connections — user + shop bios (2026-08-18, status: done)

Client: "for the social media icons in shop bios, and user bios, they
need auth to connect their accounts, do the research needed to figure
out how to implement." Research recommendation was confirmed via
`AskUserQuestion`: build this (bio verification) before login OAuth
("Both, socials first").

- `UserSocialConnection` / `ShopSocialConnection` — two separate Prisma
  models (not one polymorphic table; Prisma can't cleanly express
  "exactly one nullable owner, unique per owner+provider" with Postgres
  treating multiple NULLs as distinct). `SocialProvider` enum: DISCORD,
  TWITTER, YOUTUBE, TWITCH.
- `features/social-connections/lib/providers.ts` — per-provider OAuth2
  config (authorize/token/userinfo URLs, scope, PKCE flag for Twitter).
  Discord reuses the same app credentials as the existing developer
  "Connect Discord" flow (`DISCORD_CLIENT_ID`/`_SECRET`, already set) —
  one Discord app, two separate connection purposes (bot-owner identity
  vs. bio badge), deliberately not unified. Twitter/YouTube/Twitch need
  their own app registrations, unset for now — fail-soft, same
  convention as Stripe/Aiden/Discord: the Connect button shows but stays
  disabled until credentials exist.
- `features/social-connections/lib/oauth.ts` — generic state signing
  (`jose`, reuses `AUTH_SECRET`, 5min TTL) carrying the owner (user, or
  shop + acting user) through the redirect round-trip; PKCE pair
  generation for Twitter; code exchange; provider-user fetch (Twitch's
  Helix API needs a `client-id` header on every call, not just token
  exchange — special-cased).
  `features/social-connections/services/social-connection.service.ts` —
  connect/disconnect/list for both owners; shop connect requires
  `requireShopOwnerOrMember` (Shop.ownerUserId or a ShopMember with role
  OWNER/MODERATOR — the only two `ShopMemberRole` values that exist);
  cross-account conflict check (same provider account can't connect to
  two different KOBA users/shops).
- Three routes: `/api/social-connections/[provider]/connect`
  (`?owner=user` default or `?owner=shop&shopId=`), `.../callback`,
  `.../disconnect`.
- `features/social-connections/components/social-connections-panel.tsx`
  — reusable connect/disconnect list, wired into `/settings` (user bio,
  "Connected accounts" card) and `/business` (shop bio, "Shop socials"
  card).
- Account-linking policy for the still-unbuilt login-OAuth piece is
  already decided (confirmed via `AskUserQuestion`): no automatic
  linking by matching email — a Discord/Steam/Google login attempt on an
  existing password-based email must be blocked with a "log in with
  password first" message, never silently merged.

Not built yet: real Discord bot-ownership verification (the App Store
Discord-bot submission flow still just validates invite-link format —
`features/developers/lib/discord-invite.ts` — full ownership proof via
this same OAuth registry is a natural follow-up but wasn't requested).
Login-page OAuth itself (Discord/Steam/Google sign-in) is the next
confirmed piece of work, not started.

---

## Open questions for the client

Flagging rather than guessing on anything with real product/cost/legal consequence:

1. **TDLS encryption** — partially resolved (2026-08-15): client clarified TDLS as "Transport Discipline Layer System," a trust-boundary enforcement discipline (encryption/signing at real network hops, schema validation, replay protection, tamper-evident logging, superadmin kill switches) rather than a specific named crypto algorithm. Slice 1 is shipped — see [docs/tdls.md](docs/tdls.md): superadmin per-function kill switches (`PlatformFunctionFlag`) and a hash-chained, tamper-evident `AuditLog`. Still open: whether the original prototype's "TDLS-encrypted KOBAIDs" phrase meant something specific about KOBAID minting/storage itself (a literal encrypted-at-rest field, a signed token format?) beyond the general trust-boundary discipline now being built in slices — needs confirmation before that specific claim can be scoped.
2. **Hosting provider** — stack above is portable (Vercel/Render/Fly vs. a single AWS/GCP account). Decision affects Phase 12's sharding notes, object storage choice (S3 vs. R2), and cost model. Needs a decision before Phase 12/13 infra work, ideally before Phase 3 (Stripe webhooks need a stable public endpoint).
3. **Mobile: native app or responsive web only?** README and design prototype both show a "Desktop/Mobile toggle" implying responsive web is at minimum in scope. Is a native app (iOS/Android) also planned, and if so on what timeline relative to these 13 phases? This materially affects whether Phase 8+ (feed pagination, infinite scroll perf) needs to design for a native client from day one or can retrofit later.
4. **Voice/video call provider** (Phase 6 DMs) — hand-rolled WebRTC vs. a managed SFU (LiveKit, Twilio Video, Agora, Daily). This is a real cost and complexity decision, not a style choice; needs to be picked before Phase 6 is scoped in detail.
5. **Rarity tier naming** (Phase 3) — outline specifies "6-tier, common → relic" but only names the two endpoints. Roadmap above proposes common/uncommon/rare/epic/legendary/relic as a working default; needs client confirmation before schema/UI copy is finalized.
6. **Moderation tooling scope** (Phase 11) — outline gives Moderators "reports/warnings/suspensions only," but doesn't specify tooling depth (e.g., is there a queue/dashboard, bulk actions, appeal workflow, audit log retention requirements?). Needs scoping before Phase 11 can be estimated with confidence.
7. **Blue Badge manual review workflow** (Phase 9) — thresholds are fully specified, but the _manual KOBA staff review_ step's process (who reviews, SLA, what "manual" means operationally — a queue in the admin panel? external ticketing?) is not. Needs a decision to scope the `BlueBadgeReviewQueueEntry` workflow.
8. **Platform fee schedule** (Phase 3) — outline confirms "KOBA takes a platform fee" but not the rate, whether it's flat or tiered, or whether it differs by product type (skins vs. cosmetics vs. maps) or rarity tier. Needed before checkout/settlement logic is finalized.
9. **Search** — tech stack above defaults to Postgres full-text to avoid a premature second system, but if catalog size/complexity is expected to be large at launch, a dedicated search engine (Meilisearch/Typesense/Algolia) might be worth building in from Phase 3 rather than retrofitting. Needs a call on expected catalog scale.
10. **Console platforms and payments** — README's console list is kits/cosmetics-only (no modding/spawning). Confirm this doesn't imply a separate console storefront/app requirement (e.g., PlayStation/Xbox store compliance for in-app purchases) that would materially change Phase 3/4's payment integration scope.
11. **Data residency / age requirements (COPPA-adjacent)** — social marketplace with DMs, payments, and game-server communities likely draws a broad age range. No age-gating or regional compliance requirement is mentioned anywhere in the source material; needs an explicit decision before Phase 1 (registration flow) and Phase 6 (DMs) are built, not after.
12. **Aiden frontier-model providers** (Phase 14) — Vest recommended (Tripo AI, pay-as-you-go). Graft and Terra vendors still open; blocks wiring the actual API calls (the reconciliation pipeline itself is built and vendor-agnostic).
13. **KOBAads vs. Boost relationship** (Phase 15) — one product or two.
14. **KOBA Plus perks** — shipped 2026-08-15 (see Phase 16): real Stripe Subscriptions, $4.99/mo single tier, tenure badges, per-server bio. Animated avatar/banner and themes/icons/sounds are blocked on prerequisite features that don't exist at all (no avatar/banner upload, no theming system) — not just unwired. KOBA Shop discount + Cosmetic access still blocked on Phase 23. Multiplier perk deliberately deferred. Still open: tenure badge threshold values (placeholder), lapse-reset behavior (shipped assuming persist).
15. **Server "rarity" meaning** (Phase 17) — resolved 2026-08-15: derived from an owned, KOBA-marketplace-purchased Map set active on the server, shipped. Console RCON _and_ live stats both resolved the same day (Rust Console Edition uses Facepunch's own WebRcon, confirmed via GPORTAL's official docs; live stats reached via WebRcon's `playerlist`/`status` commands rather than needing A2S at all — no gap remains here beyond the usual "extend the game list" follow-up.
16. **Subdomain deployment strategy** (Phase 20) — single-app rewrite vs. separate deployments, and who owns DNS/TLS for `koba.games`.
17. **KOBA Shop details** (Phase 23) — cosmetic checkout model (reuse `Order` or a dedicated `CosmeticOrder`), application review workflow/SLA, hero section display logic, and how the Plus member discount interacts with the 2.5% seller fee.
18. **User interests / tag taxonomy** (Phase 1 → Phase 8) — Phase 1's outline named a mandatory "minimum 4 hashtags/interest tags" registration step feeding Phase 8's ranking, but neither the capture step nor a tag taxonomy was ever built. Phase 8's feed ranking now ships with an `interestMatch` signal deliberately held at weight 0 pending this.
19. **Reactive/Progressive Skins** (Phase 14 + Phase 21) — trigger signal, stage count/thresholds, whether a non-live "static multi-stage" v1 is acceptable while Phase 21 (KOBA PC Plugin) doesn't exist, and which games can even expose live kill/score events for KOBA to react to. See Phase 14's dedicated subsection — this is a genuinely new capability split across a buildable half (multi-stage generation) and a fully-blocked half (live in-match trigger + apply).

---

_Phases 0–13 above are the original client outline and are now fully built (see README.md for ground truth). Phases 14–23 are newer client direction, captured here as planning — not yet built except where individually noted (Phase 19, and the Aiden Studio OS pipeline scaffolding in Phase 14)._
