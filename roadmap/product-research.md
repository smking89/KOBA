# KOBA — Product Critique: Is This Idea Worth It

Scope of this document: product judgment only (scope, sequencing, user
targeting, riskiest assumptions, MVP shape, bottom line). Market
size/competitive landscape is covered by a separate parallel research
pass and is deliberately not duplicated here. Source material reviewed
in full: `README.md`, `ROADMAP.md`, `FILE_STRUCTURE.md`, and the
existing `apps/api/src/modules/{kobaid,accounts,marketplace}` code
(Phases 1-3 are real, tested NestJS modules — not just planning
prose; Phases 4-13 are planning-only, per `FILE_STRUCTURE.md`'s "What's
real vs. placeholder right now" section).

Throughout, **[STATED]** marks something the client's own README/ROADMAP
says explicitly. **[INFERRED]** marks a judgment or interpretation I'm
adding on top of that.

---

## 1. PRD-style critique: one product, or several bolted together?

**[INFERRED]** As roadmapped, KOBA is honestly five products sharing a
login system:

1. A **marketplace** (trading cards / auctions / cosmetics — eBay-meets-
   Discord-Nitro for game assets)
2. A **creator/developer platform** (Map Builder, six named APIs, sandbox,
   publishing pipeline)
3. A **social network** (feed, stories, DMs with voice/video calls,
   vanish mode, tagging)
4. An **ad network** (native KCUs, targeting, impression/click billing)
5. A **community tool** (Groups + LFG, closer to Discord than to a
   marketplace)

**[STATED]** The README's own framing — "social marketplace... trade
skins... follow shops and creators; find groups and squads" — already
telegraphs this breadth; it isn't something I'm reading into an
otherwise narrow pitch.

**Where combined scope helps [INFERRED]:**
- Marketplace + shops + influencer + dev-portal share one identity
  primitive (KOBAID) and one payments primitive (Stripe Connect via
  `StripeAccountLink`), which is architecturally sound — Phase 3's code
  already treats Stripe plumbing as shared infrastructure, not
  duplicated per phase. That's a real synergy, not just theory.
- A feed that mixes organic social content with marketplace listings
  genuinely can outperform a static storefront for *discovery* of
  cosmetics — this is the TikTok-Shop / Whatnot playbook, and it's not
  a crazy bet in principle.
- Groups/LFG could be a real acquisition channel: gamers already
  cluster in Discord-like communities around specific servers, and
  "who's selling skins for the server I'm already in" is a plausible
  hook.

**Where combined scope hurts [INFERRED]:**
- **Time-to-value for the first real user is long.** A buyer who wants
  to buy a Rust monument skin has to go through KOBAID creation,
  possibly account-mode concepts, and land in a UI that's simultaneously
  advertising Groups, LFG, a feed, and DMs before they've made a single
  purchase. Every phase after 3 that ships before there's proof buyers
  will pay is scope that could have gone into checkout friction, trust
  signals, or catalog depth instead.
- **"What is this app" gets harder to answer with every phase.** Explain
  KOBA in one sentence at Phase 3 ("buy/sell/auction game cosmetics") vs.
  at Phase 10 ("a marketplace, social network, ad platform, dev tool,
  and influencer program for game communities") — the second is a
  much harder cold-start pitch, and it's the one currently roadmapped
  before any user validation checkpoint exists.
- **Ad network (Phase 7) is scope creep relative to "trade game-server
  assets," full stop.** A native ad system is its own product with its
  own sales motion (advertisers, not buyers/sellers) and its own trust
  problems (ads that look identical to organic content is a
  dark-pattern risk, not just an engineering challenge). Nothing about
  validating "will people trade cosmetics for real money" requires an
  ad network to exist. This is the single clearest example of
  engineering-completeness thinking ("we listed 13 things, let's build
  all 13") rather than validation-driven scoping.
- **Developer portal (Phase 9) is a second product wearing the same
  skin.** Map Builder + six versioned APIs (AI Behavior, Faction
  Simulation, Event Trigger, Logistics, NPC Personality, Pack Metadata)
  is a server-tooling/dev-platform business. It has completely
  different buyers (server admins/modders), a completely different
  support burden (API docs, SDKs, versioning, sandbox infra), and zero
  dependency on whether the marketplace itself works. Bundling it under
  the same 13-phase critical path means marketplace validation is
  gated behind — or at least competing for engineering time with — an
  unrelated B2D (business-to-developer) product.

**Core vs. scope-creep phases, specifically [INFERRED]:**

| Phase | Core to "trade game-server assets"? | Verdict |
|---|---|---|
| 1 KOBAID/accounts | Yes — needed for any identity | Core |
| 2 Account switching | Partial — only needed once >1 role exists | Core-adjacent, could be simpler |
| 3 Marketplace core | Yes — this *is* the product | Core |
| 4 Shops | Yes, once sellers exist | Core |
| 5 Groups/LFG | No — community tooling, not trading | Scope creep (defer) |
| 6 Social layer (feed/DM/tagging) | Partial — discovery help, but DMs/calls/vanish mode are a full chat app | Mostly scope creep |
| 7 KOBA Ads | No | Scope creep (defer indefinitely until there's traffic worth monetizing) |
| 8 Feed engine | No, if catalog is small; Yes eventually for discovery at scale | Defer |
| 9 Developer portal | No — separate product | Scope creep (spin out or defer) |
| 10 Influencer system | No, until organic sales exist to attribute against | Defer |
| 11 RBAC | Yes, but only needs to be as deep as moderation actually requires early | Core-lite |
| 12 Schema integration | Process step, not a product phase | N/A |
| 13 API routes | Process step | N/A |

That's roughly 4 of 11 product phases that are unambiguously core to
the stated premise; the rest are either community/social features that
compete for attention or entirely separate products (ads, dev tools)
riding on the same identity system.

---

## 2. Target user validation — who is this actually for?

**[STATED]** The plan implies at least four user types: Player (buyer),
Business (shop/seller), Influencer, and Group/community owner
(server admin running LFG). KOBAID even role-codes three of these
(`PL`/`BZ`/`IN`) at the identity layer.

**[INFERRED]** This is a classic two-sided-marketplace-plus-extras
problem, and the plan is trying to bootstrap all sides simultaneously
rather than picking one to nail first. That's the highest-risk part of
the whole roadmap from a pure go-to-market standpoint, independent of
scope.

**Who has to be nailed first: sellers, not buyers.**

A marketplace with zero inventory has nothing for a buyer to evaluate,
no matter how good the browsing/feed UX is. Buyers churn instantly on
an empty catalog; sellers (server admins, existing Tebex/CurseForge
shop owners) are the harder, slower-to-acquire side because they have
switching costs (existing storefronts, existing payment setups,
existing audiences) — so they must be courted first and deliberately,
not assumed to show up once the marketplace exists.

**[INFERRED]** Concretely, the beachhead should be: **a small number
of Business-role sellers who already run a paid cosmetics storefront
for one specific game (most likely Rust, given its console edition and
existing skin-economy culture) and are willing to cross-list or
migrate.** Everything else — Influencer program, Groups/LFG, feed,
ads — is downstream of "does KOBA have anything worth browsing."

**Secondary / can-wait, ranked:**
1. **Server/community owners (Groups)** — valuable eventually as a
   distribution channel ("buy the skin pack for the server you're
   already in"), but not needed to prove the core trade loop. Can be
   simulated manually at small scale (a KOBA staff member manually
   posts in a Discord) before building a whole Groups subsystem.
2. **Influencers** — a referral/promo layer is meaningless until there
   are real organic sales to compare against; building it early risks
   optimizing for a metric (referred sales) that can't be told apart
   from cannibalized organic sales without a baseline.
3. **Buyers as a broad audience** — buyers matter, but "buyer" isn't
   one persona; the roadmap doesn't distinguish a whale-collector buyer
   (auction-driven, cares about rarity/relic tiers) from a casual
   cosmetic buyer (fixed-price, impulse-driven, cares about price and
   trust). The 6-tier rarity system and auction engine are effectively
   built for the collector persona; most of the social/feed layer is
   built for the casual browsing persona. The roadmap doesn't say which
   one KOBA is optimizing for first, and the answer changes what "core"
   even means.

**[INFERRED] Bottom line on targeting:** the plan is not wrong to
eventually serve all four personas — a real two-sided marketplace with
a creator economy on top plausibly needs all of them at maturity. The
problem is sequencing effort as if they're equally urgent now. Nothing
in the ROADMAP's phase ordering states "we are optimizing for sellers
first, buyers second, everyone else later" — and without that stated
priority, engineering time reads as flowing to whichever phase is next
in the outline's original numbering, not to whichever user segment is
most load-bearing for validating the idea.

---

## 3. Riskiest assumptions, named explicitly

For each: what KOBA is betting on, and a cheap way to test it before
building more phases against it.

1. **"Sellers with existing storefronts (Tebex, CurseForge, Sellfy-style
   server shops) will migrate or cross-list to KOBA."**
   This is the single riskiest assumption in the whole plan — the
   entire supply side depends on it, and it's untested anywhere in the
   current scope. Sellers already have payment infra, an existing
   audience, and (often) a direct relationship with a server's playerbase
   that doesn't transfer automatically to a new marketplace's audience.
   *Cheap test:* Manually recruit 5-10 sellers from Rust/Minecraft
   server communities before writing Phase 4 code; ask them to
   cross-list 3-5 items via a spreadsheet + manual Stripe payment link
   flow. If they won't do that for free with zero engineering built,
   they won't migrate once shops exist either.

2. **"Buyers will trust real-money trades for game-server cosmetics on
   a brand-new platform"** (vs. an established one like Steam Market,
   Tebex, or a server's own store).
   Trust is usually the binding constraint in P2P marketplaces for
   collectibles-adjacent goods, more than supply or UX.
   *Cheap test:* Run the manual cross-listing above as an actual paid
   pilot (real Stripe checkout, no marketplace UI) and measure
   conversion from a small paid-traffic or community-post sample —
   don't wait for Phase 3's full checkout UI to learn this.

3. **"The social/feed layer drives marketplace discovery rather than
   being ignored or actively skipped."**
   Feed-driven discovery works when there's enough content volume and
   the content itself is inherently browsable (TikTok Shop model); with
   a cold-start catalog of a few dozen items, a feed is emptier and
   less useful than a simple filterable grid, and building the feed
   ranking engine (Phase 8) before there's enough content to rank is
   solving a problem that doesn't exist yet.
   *Cheap test:* Ship a plain sortable/filterable catalog page first (no
   feed engine); instrument search vs. browse vs. "would a feed even
   have surfaced this" behavior once there's real catalog volume, and
   only build Phase 8 if catalog size and session data justify it.

4. **"Influencer referral codes create real incremental sales rather
   than cannibalizing/discounting organic ones."**
   Referral programs are frequently net-negative when there's no
   organic baseline to compare against (the influencer gets paid for
   sales that would have happened anyway), and this risk is structural,
   not an execution detail.
   *Cheap test:* Don't build Phase 10's infrastructure until there are
   several months of organic sales data from a handful of shops; then
   run one shop's referral program manually (a discount code tracked in
   a spreadsheet) and compare lift against that shop's own organic
   trend line before automating anything.

5. **"Console kit/cosmetics-only limitation doesn't cut out a meaningful
   share of the addressable market."**
   **[STATED]** the README already scopes console support down to
   "kits & cosmetics only — no custom assets or modding," which is a
   reasonable constraint given platform policy realities, but it also
   means the entire "maps/monuments/custom assets" pillar of the
   marketplace pitch is PC-only. If console players are a large chunk
   of the target playerbase for a game like Rust Console Edition, the
   product's most differentiated inventory (custom maps/monuments) is
   invisible to them.
   *Cheap test:* Before investing in Map Builder (Phase 9) or the full
   4-type product taxonomy, check actual sell-through mix once the
   marketplace is live: is revenue coming from cosmetics (works on all
   platforms) or maps/monuments/assets (PC-only)? That answer should
   determine how much further engineering investment Map Builder
   deserves.

6. **"One identity system (KOBAID) elegantly serving buyer, seller,
   influencer, and creator-API-consumer roles is a feature, not a
   liability."**
   **[INFERRED]** This is an architecture bet as much as a product bet:
   it's efficient if all four personas actually show up, but it also
   means Phase 1/2's complexity (capability flags, device binding, mode
   switching, TDLS encryption of unspecified provenance) is paid for
   up front regardless of whether Influencer or Business modes ever get
   real usage. If it turns out 95% of real usage is "Player buys from
   Business seller," a chunk of Phase 1/2's engineering (mode-switching
   UI, Influencer-mode gating, capability-flag generality) was spent
   servicing personas that didn't materialize.
   *Cheap test:* This one's harder to cheaply test pre-build since it's
   foundational, which is exactly why it's worth flagging now rather
   than after Phase 2 ships — at minimum, defer any Influencer-specific
   capability-flag work until Assumption 4 has been validated.

7. **"KOBA needs its own ad network to monetize, rather than a simpler
   take-rate-only model."**
   **[INFERRED]** Native ads are usually a later-stage monetization
   layer for platforms that already have enough attention (DAU × time
   on feed) to sell against — building it before there's meaningful
   organic traffic risks a whole phase of work with no advertisers to
   serve. The platform fee on marketplace orders (already scoped in
   Phase 3) is a simpler, already-proven monetization model for a
   marketplace; ads are additive, not necessary, at launch.
   *Cheap test:* None needed pre-build — just defer Phase 7 until
   organic DAU/session data justifies it; treat "do we have enough
   attention to sell ads against" as a launch-readiness gate, not a
   roadmap phase with a fixed position.

---

## 4. Sequencing sanity check against ROADMAP.md's own order

**[STATED]** The roadmap's own dependency graph is: 1→2→(3‖5)→4→6→7→8→
(9‖10)→11→12→13, with Phase 3 (marketplace) before Phase 4 (shops)
before Phase 5 (groups), etc.

**[INFERRED]** Judged purely as engineering dependency ordering
(does X need Y's data models to exist first), the sequencing is
internally consistent and well thought through — the ROADMAP.md
document itself is unusually rigorous about this (explicit soft vs.
hard dependencies, parallelization notes, a dedicated integration
checkpoint at Phase 12). That's a real strength of the planning
artifact.

But judged as *speed-to-validation* rather than *engineering
completeness*, it optimizes for the wrong thing:

- The plan doesn't have a **validation checkpoint** anywhere before
  Phase 12-13 (schema integration and API routes, i.e., essentially
  "everything is built"). There's no explicit "ship phase 3+4 alone,
  get real sellers/buyers, decide whether to proceed" gate written into
  the roadmap. The sequencing tells you what can be *built* in what
  order; it doesn't tell you what should be *shipped and learned from*
  before building more.
- Phases 5 through 10 (Groups, Social, Ads, Feed, Dev Portal, Influencer)
  are all engineering-dependency-valid to build in that order, but none
  of them are required to answer "will people pay real money for
  game-server cosmetics on this platform" — which is the actual
  open question. Building them before that's answered is the classic
  failure mode of a well-organized roadmap: it makes forward progress
  feel productive without de-risking the thing that matters most.
- **A smaller wedge would get real feedback faster:** ship Phase 1
  (minimal — skip mode-switching complexity, skip TDLS spec-blocked
  encryption work, skip device-binding enforcement initially), Phase 3
  cosmetics-only (no auctions, no skins/maps/monuments/assets — just
  the three pre-made cosmetic sub-types, fixed-price only), and Phase 4
  in a stripped form (a seller can list and get paid, no analytics
  dashboard, no rarity-distribution reporting), for **one game only**
  (Rust, given the console-edition skin culture and PC modding
  precedent). That is a materially smaller build than "Phase 3 before
  Phase 4" as currently scoped, and it's shippable to real users in a
  fraction of the time.

**Phases that could be deferred without blocking a real, usable v1
[INFERRED]:**
- Auctions/bidding (fixed-price only ships a usable v1 much sooner;
  auction engine's optimistic-concurrency/auto-extend logic is real
  engineering weight for a feature that matters more to collectors than
  to proving the core premise)
- Multi-game, multi-product-type catalog (skins/maps/monuments/assets
  all at once) — start with cosmetics-only or one product type, expand
  once there's proof of willingness-to-pay
- Groups + LFG (Phase 5)
- Full social layer — especially DMs' voice/video calls and vanish mode,
  which are a substantial standalone subsystem (dedicated SFU
  provider, per the roadmap's own open question #4) unrelated to
  proving the marketplace
- KOBA Ads (Phase 7) entirely, until there's organic traffic to
  monetize
- Feed engine (Phase 8) — a filterable grid is a fine substitute until
  catalog size demands ranking
- Developer Portal (Phase 9) — genuinely a separate product; defer or
  spin out
- Influencer system (Phase 10) — defer until an organic sales baseline
  exists
- Blue Badge program, RBAC's fuller Admin/Superadmin distinctions
  (a single "staff can moderate" role is enough pre-launch)

That's 6 of 13 phases deferrable without blocking a usable, sellable
v1 — roughly half the roadmap.

---

## 5. What a minimum viable version looks like

**[INFERRED]** Distinct from the current 13-phase scope, an MVP built
specifically to answer "will people pay real money for game-server
cosmetics through this platform" would look like:

- **One game** (Rust — console-edition skin culture plus PC modding
  precedent makes it the strongest candidate already implied by the
  README's own supported-games framing).
- **Cosmetics only** — the three pre-made sub-types (avatar decoration,
  profile effect, nameplate) already scoped in Phase 3, since they're
  explicitly "sold pre-made... never assembled/configured by the
  buyer" — the simplest possible listing type, no rarity-tier ambiguity
  required to launch (ship with 3 tiers, not 6, if tier count isn't
  load-bearing for the test).
- **Fixed-price only, no auctions** — removes the concurrency/audit-trail
  engineering surface entirely for the first learning loop.
- **A handful of hand-recruited sellers** (5-10 Business-role accounts,
  onboarded manually/white-glove, not via a self-serve Business-mode
  flow) — this directly tests Assumption #1 (will sellers migrate) at
  near-zero build cost.
- **Simple catalog browse + search**, no feed engine, no social layer,
  no ads, no Groups/LFG, no Influencer program, no Dev Portal.
- **Stripe Connect checkout only** — no Map Builder, no dev APIs, no
  KYC beyond what Stripe's onboarding already provides (this part of
  Phase 3/4 is already correctly scoped as "delegate to Stripe," which
  is the right call and should carry through unchanged).
- **A single staff-moderation capability** (suspend a listing/account) —
  not the full three-tier RBAC system; that can be layered in once
  there's real volume worth abusing.

This is materially smaller than Phase 3 + Phase 4 as currently
specified (drops auctions, multi-product-type catalog, shop analytics
dashboards, rarity-distribution reporting, promo/influencer config) —
and it's an order of magnitude smaller than the 13-phase vision. It
could plausibly be built and put in front of real sellers/buyers in
weeks rather than months, which is the entire point: the fastest path
to knowing whether phases 5-13 are worth building at all is proving
phases 3-4's stripped-down core first.

---

## 6. Bottom-line recommendation

**[INFERRED]** The core premise — a marketplace specifically for
game-server cosmetics/assets, with Stripe-based payments and a
KOBAID identity layer shared across roles — is not shaky on product
grounds. It's a reasonable, explainable idea with real precedent
(Steam Community Market, Tebex/CurseForge as existing seller
infrastructure, Discord Nitro's cosmetic model referenced directly in
the README) and the parts already built (Phases 1-3) are competent,
tested engineering, not vaporware.

**What is shaky is the scope-to-validation ratio.** The roadmap commits
to 13 phases — including a full social network with voice/video calls,
a native ad platform, and a six-API developer platform — before there
is any built-in checkpoint to confirm the core marketplace premise
works at all. That's the real risk: not that the idea is bad, but that
a large amount of engineering effort (Groups, Social, Ads, Feed,
Dev Portal, Influencer — roughly half the roadmap) will be spent
servicing personas and use cases (community owners, influencers,
third-party developers, advertisers) whose demand is entirely
unvalidated, while the two things that actually determine whether KOBA
works — will sellers bring inventory, will buyers pay — remain
untested until Phase 12-13.

**Recommendation: cut down before building further, don't abandon.**
Specifically:
1. Treat Phases 1-4 as the real MVP boundary, and strip even that down
   further per Section 5 (one game, cosmetics-only, fixed-price-only,
   hand-recruited sellers) before writing more Phase-4-and-later code.
2. Insert an explicit validation checkpoint after that stripped MVP —
   real sellers, real buyers, real money — before committing to Phase
   5 onward. The roadmap document should say this explicitly; right
   now it reads as committed to building phases 5-13 regardless of
   what the MVP shows.
3. Reclassify Phase 7 (Ads) and Phase 9 (Dev Portal) as separate,
   optional future initiatives rather than phases in the core
   sequence — they are different products with different buyers and
   shouldn't gate or compete with marketplace validation.
4. Defer Phase 10 (Influencer) until there's an organic sales baseline
   to measure incrementality against — building it earlier makes it
   structurally impossible to know if it's working.

**What would change this recommendation:** if the stripped-down MVP
(Section 5) gets built and shows (a) sellers willingly cross-list
without much hand-holding and (b) real buyers convert at a rate
comparable to adjacent marketplaces, that's strong evidence the
broader vision is worth the additional phases — at that point, Groups
(as a distribution channel) and Influencer (once there's a baseline)
become reasonable next bets, roughly in that order, with Ads and Dev
Portal remaining lowest-priority regardless since they're separate
products. Conversely, if sellers won't cross-list without the full
shop-analytics/Blue-Badge/promo tooling already built, or buyers don't
convert even with real inventory and working checkout, that's a signal
to reassess the core premise itself — not to build more phases hoping
social/ads/community features compensate for a marketplace that isn't
working on its own.
