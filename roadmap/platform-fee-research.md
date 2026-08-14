# KOBA Platform Transaction Fee — Research & Recommendation

Status: research + recommendation for the open question flagged in
`ROADMAP.md` ("Platform fee schedule," Phase 3, open question #8) and
`apps/api/src/modules/marketplace/stripe-connect.service.ts`'s
`PLATFORM_FEE_RATE` placeholder. This document proposes a real number to
inject into that DI token — engineering does not need to change
`calculateFee()`'s shape, only the injected rate(s), plus (per the
recommendation below) a second rate keyed on Blue Badge status.

---

## 1. Comparator table — what real platforms actually charge

All figures below are from live web research done 2026-08-13. Sourced
figures are marked **(sourced)**; anything I could not pin to a primary
source or that conflicted across secondary sources is marked
**(unverified secondary)**.

| Platform | Fee to seller/creator | Structure | Verified/tiered by status? | Source |
|---|---|---|---|---|
| **itch.io** | 0%–100%, creator-chosen; default 10% | Pure "pay what you want to the platform" — no platform-imposed floor beyond payment processing (~2.9%+$0.30) | No tiering — same slider for everyone | [itch.io Creator FAQ](https://itch.io/docs/creators/faq) |
| **Gumroad** (direct/profile sales) | 10% + $0.50/txn | % + flat | No — flat-rate since 2025 (tiered Free/Creator/Pro plans retired) | [Gumroad fee breakdown](https://dodopayments.com/blogs/gumroad-fees-explained) |
| **Gumroad Discover** (marketplace-driven sales) | 30% | % only | Yes — higher rate specifically for platform-sourced discovery traffic vs. seller's own traffic | [Gumroad pricing](https://cartmango.com/gumroad-pricing/) |
| **Etsy** | ~6.5% transaction fee + $0.20 listing fee + 3%+$0.25 US payment processing (≈9.5–10% blended + fixed) | % + flat, itemized as separate line items (not absorbed into one blended rate) | No | [Etsy Fees & Payments Policy](https://www.etsy.com/legal/fees/), [eDesk breakdown](https://www.edesk.com/blog/etsy-seller-fees/) |
| **Fiverr** | Flat 20% on every order, all seller levels | % only, flat | **No** — explicitly removed its old volume-tiered 7.5%/10%/20% structure in 2022; now uniform regardless of seller tenure/rating | [Fastlancer](https://www.fastlancer.org/en/fastlancer-blog/fiverr-review/) |
| **Roblox Marketplace** | ~30% marketplace cut before DevEx cash-out (effective ~25% net after Robux→USD exchange rate) | % only, walled virtual-currency economy — not a direct real-money-per-item analogue | No | [Roblox 30% fee explainer](https://devexfire.com/marketplace-fee.html) |
| **Steam Workshop (paid mods, where enabled)** | Creator gets 25% of Adjusted Gross Revenue in the standard model; publisher discretion for key-sale allocations | % revenue share, publisher-set per game | No published verified/unverified split | [Valve Supplemental Workshop Terms](https://steamcommunity.com/workshop/workshoplegalagreement/?appid=0), [GameSpot](https://www.gamespot.com/articles/steam-workshop-introduces-revenue-sharing/1100-6410859/) |
| **Epic Games Store** | 12% (developer keeps 88%); 100% to developer on first $1M/product/year | % only, with a revenue-threshold carve-out (not identity-verification-based, but is a *scale-based* tiering precedent) | Yes, but by revenue scale not "verified" status | [9to5Mac](https://9to5mac.com/2024/03/20/epic-will-take-12-cut-of-epic-games-store-sales-when-it-launches-on-iphone-this-year/), [Businesswire launch announcement](https://www.businesswire.com/news/home/20181204005689/en/Epic-Games-Store-Launch-88-Revenue-Share) |
| **Apple App Store Small Business Program** | 15% (vs. standard 30%) for developers under $1M/yr proceeds | % only | **Yes — the single cleanest "verified/qualifying tier gets exactly half the standard rate" precedent found** | [App Store Small Business Program, Apple Developer](https://developer.apple.com/app-store/small-business-program/) |
| **Discord Server Subscriptions** | Creator gets 90%, Discord keeps 10% (before Apple's own 30% cut if purchased via iOS) | % only | No | [Discord Creator Revenue FAQ](https://creator-support.discord.com/hc/en-us/articles/10424143128343-Creator-Revenue-FAQ) |
| **Patreon** (post-Aug 2025 structure) | New creators: flat 10%. Legacy creators: 5% (Premium, $2,500+/mo), 8% (Pro), 10% (Lite) | % only, tiered by plan/volume | Yes — explicitly tiered, higher-volume creators get materially lower rate | [Patreon Creator fees overview](https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview), [Patreon Aug 2025 fee change notice](https://support.patreon.com/hc/en-us/articles/36426991446797-A-standard-platform-fee-for-new-creators-effective-after-August-4-2025) |
| **Twitch Affiliate/Partner (subs)** | Standard 50/50; Partner Plus Level 1 = 60/40; Partner Plus Level 2 = 70/30 (unlocked at ~300 "points," e.g. ~300 subs) | % revenue share, earned tiering (not a badge review, but an earned-threshold precedent) | Yes — explicitly earned, multi-tier, similar spirit to Blue Badge's earned-not-bought design | [Variety, Twitch Partner Plus](https://variety.com/2023/digital/news/twitch-partner-plus-70-percent-revenue-split-streamers-1235645488) |
| **Stripe (payment processing, not a marketplace fee)** | 2.9% + $0.30 per US card transaction | % + flat | N/A — this stacks underneath *every* option above | Client-supplied figure, consistent with Stripe's public standard US pricing |

**Read on the data:** there is no single "industry standard." The real
split is between (a) pure creator-tools with low/no platform take
(itch.io, Gumroad direct, Epic) that compete on being seller-friendly,
and (b) marketplaces with meaningful curation/discovery/support/dispute
overhead that charge 15-30% (Fiverr, Roblox, standard Apple/Google).
KOBA is closer to the first group in spirit (creator/asset marketplace,
not a walled first-party economy) but has real discovery, feed
placement, fraud, and dispute-handling costs like the second group —
which is exactly why a two-tier structure is justified rather than
picking one number for everyone.

---

## 2. Recommended KOBA rates

**Unverified / regular shops: 12% of the gross transaction amount.**
**Blue-Badge-verified shops: 6% of the gross transaction amount.**

Both are pure percentages (see §3 for why no added flat fee), computed
on the gross order amount the buyer pays — the same base
`stripe-connect.service.ts`'s `calculateFee(amountCents)` already takes.

**Why these two specific numbers:**
- 12% for unverified sits between Etsy's ~9.5% blended rate and
  Fiverr's flat 20% — appropriate because KOBA unverified sellers carry
  Etsy-like discovery/feed benefits but, unlike Etsy, are largely
  unproven accounts (no 30-day tenure, no rating history, no sales
  volume floor) that generate disproportionate support/dispute/fraud
  load. 12% also undercuts Fiverr and Roblox's ~30%/25%-net range, so
  KOBA doesn't look punitive to a new seller comparing platforms.
- 6% for Blue Badge sits below Etsy's blended rate and below Gumroad's
  direct 10%, positioning verified KOBA shops among the cheapest
  *real-money* marketplace rates researched — deliberately competitive
  since Blue Badge shops are, by definition, already meeting a
  $2,500/30-day gross-sales floor, so KOBA's absolute dollar take stays
  meaningful even at a low percentage.

**Why a 2x gap between tiers (12% → 6%):**
This exact 2x ratio directly mirrors Apple's App Store Small Business
Program, the cleanest hard precedent found for "a verified/qualifying
tier pays exactly half the standard rate" (**sourced**: 30% → 15% for
sub-$1M developers). The gap is not arbitrary generosity; it's designed
to do two things simultaneously, consistent with how Twitch's earned
Partner Plus tiers (50/50 → 70/30, also roughly a 1.7-2x swing in
creator take) and Patreon's volume tiers (10% → 5%, also 2x) use rate
compression as a retention lever:
1. **Reward retention/loyalty and reduce platform risk.** Blue Badge
   requires 30+ days tenure, a proven 4.0★+ rating, real sustained sales
   volume, and passed manual staff review — this is a materially lower
   fraud/chargeback/support-cost population than a brand-new unverified
   shop, so a lower rate is economically justified, not just a carrot.
2. **Create a strong, legible incentive to chase the badge**, which is
   valuable to KOBA even outside the fee discount — Blue Badge shops
   are the ones KOBA wants surfacing in feed/discovery, running ads, and
   representing the platform, so the fee gap needs to be large enough
   to actually move seller behavior, not a token 1-2 point difference.

**Judgment call, flagged explicitly:** the exact 12%/6% numbers are my
synthesis from the comparator table, not a number any single cited
platform uses verbatim for a game-asset/cosmetics marketplace. Nothing
in the researched set is a perfect analogue for KOBA's specific mix
(auction + fixed-price digital game assets + Discord-Nitro-style
pre-made cosmetics). Treat 12%/6% as a well-grounded starting range —
reasonable variants would be 10-15% unverified / 5-7% verified — rather
than a number to treat as immutable before a launch pricing review.

---

## 3. Fee shape: pure percentage, not percentage+flat, with a judgment-call cap for very high-value auctions

**Recommendation: pure percentage for both tiers, no added flat KOBA fee, plus an optional per-order fee cap for high-value auction settlements.**

Reasoning, given the $2.50 nameplate → $300+ relic range:

- **Why not percentage + flat (Etsy/Gumroad style)?** Stripe's own
  $0.30 fixed fee is *already* brutal on a $2.50 item — see the math in
  §4. Stacking a second flat fee on top of Stripe's flat fee would
  double the fixed-cost drag exactly where it hurts most: the cheapest
  cosmetics, which per the roadmap's product scope (avatar decorations,
  profile effects, nameplates) are likely to be KOBA's highest-volume,
  lowest-price SKU. A pure percentage scales cleanly to $2.50 without
  compounding fixed costs.
- **Why a cap for high-value orders, and flagged as speculation:** on a
  $300+ relic auction, 12% is $36 and 6% is $18 in absolute dollars —
  not unreasonable on its own, but as rarity/price climbs further (a
  $1,000+ high-end relic auction is plausible given the 6-tier rarity
  system in Phase 3), an uncapped percentage fee starts to meaningfully
  discourage sellers from listing their best items on KOBA versus
  peer-to-peer trading. **I did not find a hard, named-platform
  precedent for a specific dollar cap in this research** (Etsy, Fiverr,
  Gumroad, Roblox, Patreon are all uncapped percentages) — this is my
  own synthesis, drawing loosely on the general marketplace pattern of
  insertion-fee caps some auction platforms have historically used for
  high-value listings. Recommend: cap the *dollar amount* of the
  platform fee at a fixed ceiling (e.g., $75 unverified / $40 verified)
  for any single order above roughly $600-650, reviewed once real
  relic-tier price data exists post-launch. Flag this cap as a "build
  the config field, decide the exact ceiling with real sales data"
  item rather than a locked number.
- **No floor is needed** on the KOBA side of the fee, because a pure
  percentage already produces a sensible minimum in cents terms at low
  prices — the actual floor problem in this product is Stripe's *own*
  $0.30 minimum, addressed in §4, not something KOBA's fee formula
  should try to solve.

---

## 4. Interaction with Stripe's processing fee — on top, not absorbed

**Recommendation: KOBA's percentage fee sits on top of Stripe's
processing fee, both itemized as separate deductions from the gross
sale amount before the seller's payout — mirroring Etsy's and Patreon's
disclosed-separately model, not Gumroad's or itch.io's absorbed-into-one-number
model.**

Why on top rather than absorbed:
- Gumroad and itch.io can quote one blended number because *they* are
  the merchant of record and negotiate/eat payment processing at scale
  internally. KOBA's architecture, per `ROADMAP.md`'s tech-stack
  section and the existing `stripe-connect.service.ts`, uses Stripe
  Connect Express accounts with sellers as the underlying account
  holder — Stripe's processing fee is a pass-through cost on the
  connected account's charge, not something KOBA can quietly fold into
  a single lower headline percentage without actually subsidizing it
  out of KOBA's own margin.
  - This is a genuine architecture-driven constraint (**sourced** from
    the codebase), not speculation.
- Etsy's model (transaction fee % + separate disclosed payment
  processing %) is the closer real-world analogue for a marketplace
  (not merchant-of-record) structure, and is the clearer, more
  auditable model for a product that (per the roadmap's `Order` model)
  needs platform-fee amounts to be independently recomputable at
  refund/dispute time — bundling Stripe's variable cost into KOBA's own
  rate would make that recomputation fragile every time Stripe's
  pricing changes.

**What this means for actual seller take-home — worked examples**
(US card, standard Stripe rate of 2.9% + $0.30, **sourced** client-
supplied figure):

| Item | Gross | Stripe fee | KOBA fee (unverified 12%) | KOBA fee (verified 6%) | Seller nets (unverified) | Seller nets (verified) |
|---|---|---|---|---|---|---|
| $2.50 nameplate | $2.50 | $0.37 (14.9% of price) | $0.30 | $0.15 | $1.83 (73%) | $1.98 (79%) |
| $25 skin | $25.00 | $1.03 (4.1%) | $3.00 | $1.50 | $20.97 (84%) | $22.47 (90%) |
| $300 relic auction | $300.00 | $9.00 (3.0%) | $36.00 | $18.00 | $255.00 (85%) | $273.00 (91%) |

**Flag, explicitly: the $2.50 item is a real problem regardless of
KOBA's own rate.** Stripe's fixed $0.30 alone is already ~15% of a
$2.50 sale before KOBA takes anything — at 12% unverified, total fees
consume ~27% of a $2.50 nameplate's price. This is not a KOBA pricing
decision so much as a catalog-policy one: I'd recommend the client
consider a minimum listing price (e.g., $2.99-$3.99) for individually
sold cosmetics specifically to keep Stripe's fixed-fee drag from
dominating the cheapest SKU, or bundling ultra-cheap cosmetics into
small packs. **This is my judgment call / synthesis, not a cited
precedent** — no platform researched publishes a minimum-price policy
tied explicitly to this reasoning, but the underlying math (fixed fee ÷
price = disproportionate drag on cheap items) is basic and
uncontroversial.

---

## 5. Summary of what's sourced vs. judgment call

**Sourced from real, cited competitor data:**
- All figures in the §1 comparator table.
- The specific 2x ratio precedent (Apple SBP 30%→15%) used to justify
  the *size* of KOBA's verified/unverified gap.
- The Stripe 2.9%+$0.30 baseline (client-supplied, consistent with
  Stripe's public pricing).
- The architectural point that Stripe Connect Express (per the existing
  codebase) makes KOBA a marketplace-not-merchant-of-record, which
  rules out the Gumroad/itch.io absorbed-fee model.

**My synthesis / judgment calls, explicitly flagged as such — not hard
precedent:**
- The exact 12% (unverified) / 6% (verified) numbers — grounded in the
  comparator range but not a direct quote of any single named
  platform's rate for this exact product category.
- The recommendation to add a dollar-amount cap on high-value auction
  fees, and the illustrative $75/$40 cap figures — no researched
  platform publishes a comparable cap.
- The recommendation for a minimum listing price on cheap cosmetics to
  manage Stripe's fixed-fee drag — a math-driven inference, not a cited
  competitor policy.
- The claim that unverified accounts carry higher average
  support/fraud/dispute cost than verified accounts — standard
  marketplace-risk reasoning, not a KOBA-specific or cited statistic
  (KOBA has no operating history yet to measure this against).

---

## 6. Implementation note (ties back to the codebase)

`PLATFORM_FEE_RATE` is currently a single injected number in
`apps/api/src/modules/marketplace/stripe-connect.service.ts`. Supporting
two rates means either (a) making `PLATFORM_FEE_RATE` resolve
per-request based on the seller's current `BlueBadgeGrant` status (Phase
9's model), or (b) widening the DI token to inject a small rate-schedule
object (`{ standardRate, verifiedRate, capCents? }`) that
`calculateFee()` reads by badge status at settlement time — the roadmap
already calls for fee computation to happen "at settlement time, not
just at checkout, so refunds/disputes recompute correctly" (Phase 3),
which is compatible with either approach as long as the rate lookup
reads the seller's badge status *as of settlement time*, not a cached
value from checkout, since Blue Badge can be revoked mid-cycle.
