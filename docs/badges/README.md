# KOBA Achievement Badges — Reference Sheet

Full catalog of every earnable badge (`features/achievements/lib/catalog.ts`), 64 total.
Badges are **earned only** — never bought, sold, or gifted. Every badge is an original
circular coin medallion (`features/achievements/components/badge-frame.tsx`) with a recessed
emblem panel behind the glyph. Ladder badges (account age, trade volume, game collector,
Boost rank) emboss a bold rank numeral into that panel instead of a distinct icon per rung.

KOBA Plus tenure badges are the one exception to the coin shape: they render as a faceted
gem-cut shield (`features/achievements/components/plus-gem-badge.tsx`), traced directly
from the client's own 6 hand-drawn outline sketches (2026-08-17). Every tier shares one
shield silhouette (apex, faceted shoulders, a rounded taper to the point); what changes per
tier is the accessory built onto it, exactly as drawn: Bronze is the shield alone; Silver
gets a small arc nested inside the shield near the tip; Gold cuts the shield short and hangs
a plain teardrop gem below it; Diamond keeps the full-length shield and adds a 6-petal fan
flaring from the shoulders, plus the same plain teardrop; Emerald adds a marquise gem above
the apex, an arched double band across the shoulders, and a round gem stud at each shoulder,
and its teardrop grows a segmented chevron tail; Ruby has the identical marquise/arch/studs/
petals as Emerald but keeps a plain teardrop (no tail) — exactly what the client drew.
Platinum and Opal weren't in the client's 6 examples (6 of KOBA's 8 real Plus tiers);
extrapolated in the same language — Platinum carries Silver's arc and Gold's teardrop
together, Opal reuses Emerald's full ornament set in the original KOBA Plus rainbow
spectrum. Each tier is rendered in its own real gem material (bronze copper, silver, gold,
cool platinum, icy diamond, emerald green, ruby red). The real KOBA Plus mark
(`public/brand/koba-plus-mark.png`, client-supplied) is engraved into the center of every
tier using the same light/dark relief technique as the coin badges — built into the gem's
own tones, not a separately-colored sticker glued on top.

## Special (10)

| Badge | Name | Rarity | Description | Threshold |
|---|---|---|---|---|
| ![](plus-bronze.png) | **KOBA Plus** | Common | Active KOBA Plus subscriber. | 0 |
| ![](plus-silver.png) | **KOBA Plus — Silver** | Common | KOBA Plus subscriber for 3+ months. | 3 |
| ![](plus-gold.png) | **KOBA Plus — Gold** | Uncommon | KOBA Plus subscriber for 6+ months. | 6 |
| ![](plus-platinum.png) | **KOBA Plus — Platinum** | Rare | KOBA Plus subscriber for 12+ months. | 12 |
| ![](plus-diamond.png) | **KOBA Plus — Diamond** | Rare | KOBA Plus subscriber for 24+ months. | 24 |
| ![](plus-emerald.png) | **KOBA Plus — Emerald** | Epic | KOBA Plus subscriber for 36+ months. | 36 |
| ![](plus-ruby.png) | **KOBA Plus — Ruby** | Legendary | KOBA Plus subscriber for 60+ months. | 60 |
| ![](plus-opal.png) | **KOBA Plus — Opal** | Relic | KOBA Plus subscriber for 72+ months. | 72 |
| ![](influencer-partner.png) | **Influencer Partner** | Rare | Active KOBA Influencer partner. | — |
| ![](founding-member.png) | **Founding Member** | Relic | Joined KOBA in its very first month. | — |

## Tenure (10)

| Badge | Name | Rarity | Description | Threshold |
|---|---|---|---|---|
| ![](account-age-1y.png) | **First Anniversary** | Common | Been part of KOBA for 1 year. | 1 |
| ![](account-age-2y.png) | **Two-Year Veteran** | Common | Been part of KOBA for 2 years. | 2 |
| ![](account-age-3y.png) | **Three-Year Veteran** | Uncommon | Been part of KOBA for 3 years. | 3 |
| ![](account-age-4y.png) | **Four-Year Veteran** | Uncommon | Been part of KOBA for 4 years. | 4 |
| ![](account-age-5y.png) | **Five-Year Veteran** | Rare | Been part of KOBA for 5 years. | 5 |
| ![](account-age-6y.png) | **Six-Year Veteran** | Rare | Been part of KOBA for 6 years. | 6 |
| ![](account-age-7y.png) | **Seven-Year Veteran** | Epic | Been part of KOBA for 7 years. | 7 |
| ![](account-age-8y.png) | **Eight-Year Veteran** | Epic | Been part of KOBA for 8 years. | 8 |
| ![](account-age-9y.png) | **Nine-Year Veteran** | Legendary | Been part of KOBA for 9 years. | 9 |
| ![](account-age-10y.png) | **Decade Club** | Relic | Been part of KOBA for 10 years. | 10 |

## Trading (21)

| Badge | Name | Rarity | Description | Threshold |
|---|---|---|---|---|
| ![](trade-casual.png) | **Casual Trader** | Common | Completed 1 item trade. | 1 |
| ![](trade-recreational.png) | **Frequent Trader** | Common | Completed 3 item trades. | 3 |
| ![](trade-dedicated.png) | **Dedicated Trader** | Uncommon | Completed 7 item trades. | 7 |
| ![](trade-committed.png) | **Committed Trader** | Uncommon | Completed 15 item trades. | 15 |
| ![](trade-serious.png) | **Serious Trader** | Rare | Completed 25 item trades. | 25 |
| ![](trade-devoted.png) | **Devoted Trader** | Rare | Completed 40 item trades. | 40 |
| ![](trade-seasoned.png) | **Seasoned Trader** | Epic | Completed 60 item trades. | 60 |
| ![](trade-ironclad.png) | **Ironclad Trader** | Epic | Completed 90 item trades. | 90 |
| ![](trade-unshakeable.png) | **Unshakeable Trader** | Legendary | Completed 130 item trades. | 130 |
| ![](trade-eternal.png) | **Eternal Trader** | Relic | Completed 200 item trades. | 200 |
| ![](collector-sampler.png) | **Sampler** | Common | Own items from 2 different games. | 2 |
| ![](collector-dabbler.png) | **Dabbler** | Common | Own items from 4 different games. | 4 |
| ![](collector-enthusiast.png) | **Enthusiast** | Uncommon | Own items from 6 different games. | 6 |
| ![](collector-ranger.png) | **Ranger** | Uncommon | Own items from 9 different games. | 9 |
| ![](collector-explorer.png) | **Explorer** | Rare | Own items from 12 different games. | 12 |
| ![](collector-adventurer.png) | **Adventurer** | Rare | Own items from 16 different games. | 16 |
| ![](collector-voyager.png) | **Voyager** | Epic | Own items from 20 different games. | 20 |
| ![](collector-maverick.png) | **Maverick** | Epic | Own items from 26 different games. | 26 |
| ![](collector-polymath.png) | **Polymath** | Legendary | Own items from 34 different games. | 34 |
| ![](collector-universalist.png) | **Universalist** | Relic | Own items from 44 different games. | 44 |
| ![](relic-collector.png) | **Relic Collector** | Relic | Owns a Relic-rarity item. | — |

## Marketplace (18)

| Badge | Name | Rarity | Description | Threshold |
|---|---|---|---|---|
| ![](boost-rank-1.png) | **Boost Rank I** | Common | Purchased 1 Boost in total. | 1 |
| ![](boost-rank-2.png) | **Boost Rank II** | Common | Purchased 2 Boosts in total. | 2 |
| ![](boost-rank-3.png) | **Boost Rank III** | Uncommon | Purchased 3 Boosts in total. | 3 |
| ![](boost-rank-4.png) | **Boost Rank IV** | Uncommon | Purchased 5 Boosts in total. | 5 |
| ![](boost-rank-5.png) | **Boost Rank V** | Rare | Purchased 8 Boosts in total. | 8 |
| ![](boost-rank-6.png) | **Boost Rank VI** | Rare | Purchased 12 Boosts in total. | 12 |
| ![](boost-rank-7.png) | **Boost Rank VII** | Epic | Purchased 18 Boosts in total. | 18 |
| ![](boost-rank-8.png) | **Boost Rank VIII** | Legendary | Purchased 25 Boosts in total. | 25 |
| ![](boost-rank-9.png) | **Boost Rank IX** | Relic | Purchased 35 Boosts in total. | 35 |
| ![](shop-owner.png) | **Shop Owner** | Common | Opened a shop on KOBA. | — |
| ![](first-sale.png) | **First Sale** | Uncommon | Made your first sale. | — |
| ![](auction-winner.png) | **Highest Bidder** | Uncommon | Won an auction. | — |
| ![](verified-shop.png) | **Verified Seller** | Rare | Your shop passed KOBA verification. | — |
| ![](auction-champion.png) | **Auction Champion** | Rare | Won 5 auctions. | — |
| ![](big-spender.png) | **Big Spender** | Epic | Spent $500 or more on the Marketplace. | — |
| ![](century-sales.png) | **Storefront Staple** | Epic | Sold 100 orders from your shop. | — |
| ![](top-seller.png) | **Top Seller** | Legendary | Sold 500 orders from your shop. | — |
| ![](whale.png) | **Whale** | Legendary | Purchased 10,000 or more KOBA Coins in total. | — |

## Community (5)

| Badge | Name | Rarity | Description | Threshold |
|---|---|---|---|---|
| ![](first-comment.png) | **Conversation Starter** | Common | Left your first comment on a product. | — |
| ![](critic.png) | **Critic** | Uncommon | Wrote 10 shop reviews. | — |
| ![](social-butterfly.png) | **Social Butterfly** | Uncommon | Published 25 posts. | — |
| ![](prolific-poster.png) | **Prolific Poster** | Rare | Published 100 posts. | — |
| ![](trusted-seller.png) | **Trusted Seller** | Epic | Shop holds a 4.5+ average rating across 10 or more reviews. | — |

---

### Source of truth

This sheet is generated directly from `features/achievements/lib/catalog.ts`
(`ACHIEVEMENT_CATALOG` + `LADDER_THRESHOLDS`) and rendered through the same
`BadgeFrame` component and real `koba-plus-mark.png` the app itself uses — it's a
snapshot, not live data, so regenerate it whenever the catalog changes.