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
- [Phase 18 — Freebie Products](#phase-18--freebie-products)
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

**Scope, as engineering deliverables**

- Unified feed combining organic `SocialAction`/content and `KcuUnit` ads (Phase 7) into one ranked, paginated stream.
- Ranking signal inputs: user interests (Phase 1), social actions (Phase 6), tag relevance (Phase 6), marketplace activity (Phase 3), group activity (Phase 5), ad targeting (Phase 7), cosmetic engagement (Phase 3), influencer promo activity (Phase 10 — soft dependency, can stub this signal until Phase 10 ships).
- Caching/pagination strategy for infinite scroll: cursor-based pagination, Redis-backed precomputed feed pages/scores rather than recomputing rank on every request.
- This phase is explicitly a _ranking and delivery_ layer — it does not own the underlying content models, only queries and scores them.

**Data models / entities**

- `FeedRankingSignal` (weights/config per signal type — likely a config table, not per-row data)
- `FeedCacheEntry` (Redis: user_id/session → cached ranked page, cursor, TTL)
- No new primary content entities — this phase is read/aggregation-heavy over everything built in Phases 1-7.

**Dependencies**

- Phases 1, 3, 5, 6, 7 (all ranking signal sources). Phase 10's signal can be stubbed and back-filled later without a schema change if `FeedRankingSignal` is designed as an extensible weight table up front.

---

## Phase 9 — Developer Portal

**Scope, as engineering deliverables**

- Access gate: Business-mode only (reuses Phase 2's mode gating).
- Map Builder: the one genuine "builder" in the product — skins/monuments/cosmetics are uploaded pre-made, packs are just bundles of existing products (no packing/building logic needed beyond a bundle reference list). Scope Map Builder as its own substantial feature (asset placement, terrain/prefab tooling scoped per-game — this will need its own design pass per supported PC game, since RCON/modding capabilities differ by title per the README's supported-games table).
- KOBA APIs exposed to developers: AI Behavior, Faction Simulation, Event Trigger, Logistics, NPC Personality, Pack Metadata. Each is effectively its own mini-product — recommend treating each as a separately versioned API surface with its own docs/sandbox rather than one monolithic "dev API."
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

**Status: real pipeline built (Aiden Studio OS), no vendor wired yet.**
See [docs/aiden-studio-os.md](docs/aiden-studio-os.md) for the full
architecture. What's real:

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
- **Vest/Graft/Terra providers** (`features/aiden/providers/*.ts`) each
  fail closed on an unconfigured env var, same pattern as
  `features/payments/lib/stripe.ts`'s `isStripeConfigured` — genuinely
  ready for a real vendor SDK to be dropped in, zero changes needed
  upstream of the provider file itself.
- The `/aiden/generate` UI now actually submits to `POST /api/aiden/jobs`
  (previously a non-functional mock button) and shows real failure
  reasons; `/aiden/library` links to `assetUrl` once a real generation
  exists.

**Still missing — the actual vendor call:**

- Real frontier-model API integration — three separate vendor
  integrations, one per modality (image/skin generation for Vest, 3D
  generation for Graft, map/terrain generation for Terra). **Vendor
  research done**: Tripo AI recommended for Vest (pay-as-you-go, no
  subscription — $0.01/credit — with auto-rig + auto-animation in one
  API, the best fit for "fully rigged, animated, game-ready" skins).
  Meshy ruled out (subscription-gated API access). Graft/Terra vendor
  still open. Regardless of vendor: converting the generated
  mesh/texture into a specific game's actual file format (FBX export,
  skeleton retargeting to that game's animation set) is deterministic
  glue work KOBA has to build itself (e.g. a headless Blender automation
  service) — no vendor does this step.
- Successful generations publishing directly to the KOBA marketplace as a
  new `Product`/`Cosmetic` (still enters the existing moderation queue,
  no bypass) — not built yet, the pipeline stops at asset creation today.

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

1. Frontier model provider per modality — Vest (image gen), Graft (3D/
   asset gen), Terra (procedural map gen) plausibly need three different
   vendors. Which, and what's the pricing/usage-reporting shape for each
   (needed to build the actual-cost reconciliation)?
2. Exchange rate: USD-cost-of-generation → KOBA Coins. Fixed multiplier,
   or does it track the same live Coin-purchase pricing (Phase 15,
   `features/wallet/lib/coin-packages.ts`)?
3. Failure/retry policy — if a frontier-model call fails or returns a
   low-quality result, is the reservation fully released, partially
   captured (compute was spent even if output was rejected), or does the
   user get one free retry?

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
- **Applicable to multiple target kinds**: a product, a shop, or a group
  — "or any supported feature," so the target-kind list is deliberately
  designed to extend (e.g. LFG posts) without a schema rewrite.
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
   confirm the v1 target-kind list (product, shop, group) is right, or
   whether LFG posts / KCU ad units themselves should be boostable
   targets from day one.
3. KOBAads campaign targeting/budget model — still fully open, see above.

---

## Phase 16 — KOBA Plus (subscriptions)

A recurring paid subscription tier — subscription-style profile/shop
customization and platform perks, not gameplay advantages. `/plus`
already exists as a UI shell (owner-expansion "UI foundations").

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

- `SubscriptionPlan` (tier name, price, Stripe price ID, perks list).
- `UserSubscription` (userId, planId, status, stripeSubscriptionId,
  currentPeriodEnd, cancelAtPeriodEnd).
- `ServerBio` (userId, gameServerId, bio) — new, for the per-server bio
  perk; today `AccountProfile.bio` is account-wide only.
- Badge-tier derivation needs a tenure clock — likely
  `UserSubscription.createdAt` (first-subscribed date) rather than a
  separate field, pending confirmation there's no "reset on lapse" rule
  (see open questions).

**Dependencies**

- Stripe integration patterns already established (`features/payments/
lib/stripe.ts`, webhook signature verification) extend naturally, but
  this is new Stripe API surface, not a copy-paste of checkout.service.ts.
- Phase 23 (KOBA Shop) for the member-discount perk to have something to
  discount.

**Open questions for the client**

1. The multiplier/boost perk — what platform mechanic does it apply to,
   and what's the multiplier value (flat, or does it scale with tenure
   badge like the profile badge perk)?
2. Price point(s) — single tier, or multiple tiers with different perk
   subsets (e.g. animated avatar at tier 1, per-server bio at tier 2)?
3. Member discount rate on KOBA Shop cosmetics — flat percentage, or
   tiered like the multiplier perk?
4. Does a lapsed/cancelled subscription revoke perks immediately at
   period end, or is there a grace period? And does tenure badge progress
   reset on lapse, or persist/resume?

---

## Phase 17 — Game Server Directory + Live RCON

`/servers`, `/servers/[serverId]`, `/servers/connect` already exist with
real scaffolding — this phase is about making the "live" part actually
live, not building from scratch.

**Already built, confirmed against current code:**

- `GameServer` model: `game`, `platformFamily` (PC | CONSOLE), `region`,
  `tags[]`, `livePlayers`, `maxPlayers`, `queue`, `mapName`, `mapSize`,
  `host`/`port`, `rconTestState` — covers nearly every field the client
  asked for (live player count, player queue, map size, tags, console-or-
  PC) except **rarity**, which has no server-level concept today (rarity
  is currently a `Product`/`Cosmetic` field — see open question below).
- `ServerCredential`: RCON credentials stored encrypted at rest
  (ciphertext/iv/authTag — AES-GCM-shaped), never plaintext.
- Full connect wizard UI (`features/servers/components/server-connect-
wizard.tsx`) and directory UI (`server-directory.tsx`), gated to
  Business/Influencer accounts (`assertBusinessOrInfluencer`).
- `testRconConnection` exists but **is a stub** — it only checks whether
  `host`/`port` are set and reports `SUCCESS`/`UNSUPPORTED` accordingly;
  it does not open a real RCON connection to any game server today.

**Scope, as engineering deliverables**

- Real per-game RCON protocol adapters. Different games use different
  RCON implementations (e.g. Source RCON for Rust and other Source-
  engine titles is one well-known protocol, but it is not universal) —
  this needs a protocol-adapter architecture keyed by `game`, not one
  integration. Launch game list is an open question below.
- Live polling to keep `livePlayers`/`queue`/`mapName`/`mapSize` current
  — needs an architecture decision (poll on a schedule vs. a persistent
  connection per server) with real infra-cost implications at scale.
- Resolve the "rarity" requirement — either add a server-level rarity/
  tier field (distinct from product rarity) or confirm the client meant
  something else (e.g. rarity of items _available_ on that server).

**Dependencies**

- Shop (done) — servers already link to an owning shop.
- `ServerCapability`/`ServerOnlineStatus`/`RconTestState` enums (done).

**Open questions for the client**

1. Launch game list — which games' RCON protocols need day-one support?
2. What does "rarity" mean for a server? A new server-level field, or a
   summary of the rarest item(s) available/tradeable there?
3. Polling cadence vs. persistent-connection budget for live stats.

---

## Phase 18 — Freebie Products

Sellers can mark a product free — **permanently**, or **for a fixed
initial quantity** (e.g. "first 15 free," then it reverts to its normal
paid price). Surfaced on a dedicated "Freebie" tab. Not built yet;
no existing schema field or route covers this.

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

**Open questions for the client**

1. Does a limited-quantity freebie ever replenish (e.g. weekly reset), or
   is "first 15" a one-time lifetime pool per product?
2. Does claiming a freebie count toward the same per-buyer purchase
   limits/analytics as a paid order, or is it tracked separately?

---

## Phase 19 — Rarity-Matched Trading (status: done)

**This phase is already built** — flagged here only so it's tracked
alongside the rest of this document, not because it's outstanding work.

Client rule: only items of the **same rarity tier** may be traded against
each other (fairness constraint). Confirmed live in
`features/trade/lib/rarity-policy.ts#assertSameRarityTrade`, enforced by
the trade offer/accept flow shipped with item trading. No gap here.

---

## Phase 20 — Multi-Subdomain Architecture

Client-specified domain structure:

| Subdomain              | Purpose                        | Current state                          |
| ---------------------- | ------------------------------ | -------------------------------------- |
| `koba.games`           | Main site                      | This app, path-based routing           |
| `developer.koba.games` | Developer portal               | Exists at `/developers` (mock/UI-only) |
| `app.koba.games`       | App store                      | Exists at `/developers/apps` (mock)    |
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
  (new post, new listing). Note: this rides on whatever feed exists
  today — a plain reverse-chron feed (Phase 8's full ranked Feed Engine
  isn't built yet), so "live feed" here means "new item posted," not a
  ranked/curated stream.
- **Item delivery**: once a purchase completes, the bot delivers the
  in-game item. For server-deliverable items this should reuse Phase 17's
  RCON infrastructure (the bot triggers a give-item RCON command against
  the buyer's linked server account); for client-side skins this
  coordinates with the Phase 21 plugin instead — the bot itself doesn't
  reach into a player's PC.
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
14. **KOBA Plus perks** — mostly specified (2026-08-15, see Phase 16): tenure badges, animated avatar/banner, per-server bio, themes/icons/sounds, KOBA Shop member discount, and Cosmetic sub-type access. Still open: the exact multiplier/boost perk mechanic, price point(s), member discount rate, and lapse/grace-period behavior.
15. **Server "rarity" meaning** (Phase 17) — not a concept that exists on `GameServer` today; needs clarification on what it should represent.
16. **Subdomain deployment strategy** (Phase 20) — single-app rewrite vs. separate deployments, and who owns DNS/TLS for `koba.games`.
17. **KOBA Shop details** (Phase 23) — cosmetic checkout model (reuse `Order` or a dedicated `CosmeticOrder`), application review workflow/SLA, hero section display logic, and how the Plus member discount interacts with the 2.5% seller fee.

---

_Phases 0–13 above are the original client outline and are now fully built (see README.md for ground truth). Phases 14–23 are newer client direction, captured here as planning — not yet built except where individually noted (Phase 19, and the Aiden Studio OS pipeline scaffolding in Phase 14)._
