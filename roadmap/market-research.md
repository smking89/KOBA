# KOBA — Market Research: Is There a Real Market Here?

Research date: 2026-08-13. This document assesses market demand for KOBA
as scoped (social marketplace for game-server skins/maps/monuments/assets
+ pre-made cosmetics + social/influencer layer, across the supported-game
list in `README.md`) — not implementation feasibility. Sourced figures are
cited inline; anything reasoned/estimated rather than pulled from a
primary source is explicitly flagged as **speculation**.

---

## 1. Market sizing (TAM/SAM/SOM)

### Anchor data points (sourced)

| Data point | Figure | Source |
|---|---|---|
| CS2 skin market (adjacent proof point — **not** a KOBA-supported game) | $3.5–4.2B annual trading volume in 2025; Steam Community Market alone averages >$5M/day turnover | [SteamAnalyst CS2 Market Report 2025](https://www.steamanalyst.com/guides/cs2-market-report-2025) |
| Tebex (closest direct competitor — see §2) cumulative GMV | >$1B processed over 14 years of operation | [PocketGamer.biz Tebex spotlight](https://www.pocketgamer.biz/company-spotlight-tebex/) |
| Tebex creator payouts, single year | $240M paid to creators in 2024 | search-aggregated, Tebex/Naavik reporting |
| Tebex single-game example (FiveM/GTA, not a KOBA game) | $366.9M GMV | Dealroom/Naavik reporting |
| Codefling (direct Rust maps/monuments/plugins marketplace — see §2) | 41,100 registered members, flat 10% platform fee | [Codefling Creators page](https://codefling.com/creators/), site search aggregation |
| BuiltByBit (formerly MC-Market, Minecraft resource/plugin marketplace) | Described as "largest marketplace for Minecraft, Roblox, Website and Discord assets"; hundreds of paid resources per category | [BuiltByBit](https://builtbybit.com/) |
| Discord Nitro | $280M revenue in 2025 from 7.3M subscribers (~29.5% of Discord's total revenue) | search-aggregated Discord revenue reporting |
| Discord cosmetics (stickers/avatar decorations) | ~10–15% of Discord's total income | search-aggregated Discord revenue reporting |
| Rust concurrent players | ~116k–137k live (varies by tracker), all-time peak 262,284 (Jan 2, 2025) | [SteamDB Rust charts](https://steamdb.info/app/252490/charts/), [PlayerAuctions Rust population](https://www.playerauctions.com/player-count/rust/) |
| Minecraft monthly active players | 212.32M MAU early 2026 (peak 222.5M June 2025, boosted by the 2025 Minecraft Movie) — **note this spans Java+Bedrock+console+mobile; Java-specific PC MAU (the KOBA-relevant subset) is materially smaller and not precisely findable, treat any Java-only figure as speculation** | [Demandsage Minecraft stats](https://www.demandsage.com/minecraft-statistics/) |
| Valheim | 28,997 peak concurrent, July 2025 | search-aggregated Steam Charts data |
| 7 Days to Die | ~25,805 concurrent (snapshot) | Steambase/SteamCharts |
| ARK, DayZ, Conan Exiles concurrent counts | **Not reliably pinned down in this research pass** — treat as low-to-mid five-figure concurrent counts each based on general genre positioning, this is **speculation**, not sourced | — |

### TAM / SAM / SOM (explicitly a synthesis, not a cited figure — speculation)

**TAM (broad):** total annual real-money spend on server-side cosmetics,
perks, and player-made content (maps/mods/skins) across KOBA's entire
supported-game list. Using Tebex's disclosed scale as the best available
proxy for "how much money already flows through this general category"
(hundreds of millions/year across dozens of games, of which KOBA's list
is a meaningful but partial subset — Minecraft and Rust are two of
Tebex's largest categories per public case studies, though Tebex doesn't
publish a KOBA-list-specific breakdown), a reasonable TAM estimate is
**roughly $300M–$800M/year** in transactable spend across KOBA's 14 PC
titles combined (cosmetics + assets + maps/mods). **This range is
synthesized, not sourced — flagged as speculation.**

**SAM (serviceable):** narrower to what KOBA could plausibly compete for
— PC-only, full-support titles where custom content/cosmetics trading is
both technically possible and not already fully captured by an entrenched
per-game tool (i.e., excluding the portion of Minecraft/ARK spend that's
already locked into official/semi-official channels — see §3a). A
reasonable estimate is **$50M–$150M/year**, concentrated overwhelmingly
in Minecraft and Rust (the two titles with by far the largest active
communities and existing paid-content precedent), with ARK, DayZ, Conan
Exiles, Valheim, 7 Days to Die, and the smaller titles (Unturned, GMod,
S&Box, Project Zomboid, Eco, Terraria, Starbound) contributing a long
tail. **Speculation, grounded in the sourced anchor points above but not
itself a cited number.**

**SOM (realistic KOBA capture, years 1–3):** a brand-new two-sided
marketplace entering a category with entrenched, low-friction incumbents
(Tebex for server monetization, Codefling/BuiltByBit for
Rust/Minecraft assets specifically) typically captures low single-digit
percentages of SAM in its first few years, if it survives at all. A
realistic Year 1–3 GMV target is **$1M–$5M/year**, which at KOBA's
proposed 8%/4% blended fee (call it ~6% blended average) translates to
**roughly $60K–$300K/year in platform revenue** — a modest, not
venture-scale, outcome unless a specific wedge (see §4) breaks out.
**This is a speculative estimate based on typical marketplace bootstrap
trajectories, not a KOBA-specific projection from real data.**

**Bottom line on sizing:** the category is real and has genuine
multi-hundred-million-dollar precedent (Tebex, Discord cosmetics, the
CS-skin economy as an upper-bound analogue), but it is not a
greenfield opportunity — most of the addressable spend already flows
through specific, well-entrenched tools per game (see §2), and KOBA's
SAM is meaningfully smaller than the TAM headline number would suggest
once those incumbents are netted out.

---

## 2. Competitive landscape

| Competitor | What it does that overlaps KOBA | Gap KOBA claims to fill | How real is the gap |
|---|---|---|---|
| **Tebex (formerly Buycraft)** | The dominant "sell ranks/perks/cosmetics on my Minecraft/Rust/ARK/GTA server" tool. >$1B cumulative GMV, $240M creator payouts in 2024 alone, built-in tax compliance, fraud/chargeback handling with "100% insurance," 130+ payment methods. Directly supports Minecraft, Rust, ARK, GTA/FiveM. [Source](https://www.pocketgamer.biz/company-spotlight-tebex/) | KOBA adds a cross-game social feed, discovery/follow mechanics, an influencer/referral layer, auctions, and a unified cross-title identity (KOBAID) — Tebex is a checkout widget bolted onto a server's own site, not a destination marketplace with its own audience or social graph. | **Real but narrow.** Tebex deliberately doesn't try to be a marketplace *destination* — it's payment/monetization infrastructure a server owner embeds elsewhere. KOBA's bet is that a discovery layer on top of that infrastructure has value server owners will pay/switch for. That's plausible but unproven — Tebex's own scale suggests most server owners are satisfied with "embed a widget on my existing Discord/site," not clearly starved for a separate marketplace presence. See §3c. |
| **Codefling** | Direct, real-money marketplace for Rust plugins, **custom maps, and monuments** — the exact niche KOBA is targeting for Rust specifically. 41,100 registered members, flat 10% fee, instant creator payout. [Source](https://codefling.com/creators/) | KOBA adds cross-game reach (not just Rust), social/feed discovery, auctions, and cosmetics bundled into one product. | **This is the single most direct existing competitor for KOBA's "custom maps and monuments" pillar, and it's likely underweighted in the client's own framing.** It proves the specific niche (real-money Rust map/monument marketplace) already works at a real, if modest, scale (~41K members, sustained operation) — good validation that demand exists, but also a live incumbent with community trust and a 10% fee already lower than KOBA's proposed unverified-tier 8% is *not* obviously beaten — KOBA's 8%/4% is competitive but not a decisive undercut versus Codefling's flat 10% once Blue-Badge status is unlikely for most new sellers on day one. |
| **BuiltByBit (formerly MC-Market)** | The equivalent incumbent for Minecraft — the largest marketplace for Minecraft plugins/resources/assets, paid real-money transactions, hundreds of resources per category. [Source](https://builtbybit.com/) | Same as Codefling: KOBA's differentiation is cross-game + social + cosmetics, not "a marketplace for Minecraft assets" per se, since that already exists and is entrenched. | **Real, entrenched incumbent.** Same read as Codefling — validates demand, but is a direct competitor for the Minecraft slice of KOBA's marketplace pillar, not just an adjacent analogue. |
| **Steam Community Market / Steam Workshop** | Official secondary market for Steam-tradeable Rust skins (drop/limited skins, not permanent-store items — see §3a); Workshop supports paid mods on a publisher-opt-in basis with a 25% creator revenue share precedent (Skyrim). [Sources: [Facepunch permanent store news](https://rust.facepunch.com/news/permanent-store), [SkinSwap Rust skins guide](https://skinswap.com/blog/en/rust/how-to-sell-rust-skins-for-real-money-in-2026-the-complete-step-by-step-guide/), [GameDeveloper on Workshop paid mods](https://www.gamedeveloper.com/business/game-mods-can-now-be-sold-on-the-steam-workshop-for-real-money)] | KOBA can't compete with or replace the *official* Rust skin market — it wouldn't try to; Rust skins specifically are arguably out of scope for real trading value on KOBA since the liquid, trusted venue already exists inside Steam itself. | Not really a gap to fill — more a boundary condition: KOBA's Rust-skin listings will always be competing against a more liquid, Valve-backed venue for the exact same tradeable items. KOBA's real opportunity in Rust is server-side content (maps/monuments/plugins), where Steam Market has no presence — same conclusion as the Codefling comparison above. |
| **Epic's Fab (merged Unreal Marketplace/Sketchfab/Quixel, launched Oct 2024)** | Unified 3D-asset marketplace, 88/12 creator revenue split. [Source](https://www.cgchannel.com/2024/10/epic-games-launches-its-new-fab-marketplace-in-october-2024/) | Essentially no overlap — Fab serves game *developers* building new games with reusable engine assets (Unreal/Unity), not players/server-admins buying pre-made content for a specific live game's community. | **Gap is real but the comparison itself is mostly irrelevant** — Fab is not a competitor to KOBA in any practical sense; the client's framing of it as a comparator should be treated as a weak/low-signal data point, not evidence either way. |
| **CurseForge / Modrinth** | Dominant mod-distribution platforms for Minecraft and (via a 2023+ partnership) ARK: Survival Ascended. CurseForge: 800M+ monthly mod downloads, 11M+ MAU, 226,000+ hosted projects. Modrinth: 100,000+ projects, 23.5M monthly visits. Both are overwhelmingly free/donation-based **except** ARK:SA's "Premium Mods" program (see §3a — creators get 50% and must use a Tebex wallet to get paid). [Sources: [tech-insider.org CurseForge/Modrinth stats](https://tech-insider.org/ie/nexus-mods-vs-curseforge-vs-modrinth-2026/), [CurseForge ARK Premium Mods policy](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods)] | KOBA claims to offer what these don't: a native real-money marketplace, not "free unless the platform-owner opts a specific game into a premium-mod pilot." | **Real gap, but it's evidence of restraint, not opportunity, until proven otherwise.** CurseForge/Modrinth's near-total avoidance of real-money sales (despite obvious scale and obvious demand-side willingness, given 800M downloads/month) is itself a signal — either (a) publishers structurally resist real-money mod economies (ToS risk — see §3a), or (b) the free/donation model works fine for this specific creator base and a paid layer hasn't been worth the complexity. ARK:SA's premium-mod pilot funneling payments through Tebex specifically (not a standalone marketplace) is a live, recent (2023-24) data point that even when a publisher *does* open the door to real money, it still routes through Tebex's existing payment/compliance rails rather than inventing a new destination marketplace — a structural headwind for KOBA's "we'll be the marketplace" positioning on ARK specifically. |
| **Discord Nitro / Server Subscriptions** | The cosmetics model KOBA explicitly mirrors (pre-made, non-buildable decorations/effects/nameplates sold like inventory items). $280M Nitro revenue (2025, 7.3M subscribers); cosmetics ~10-15% of Discord's total revenue. [Source: search-aggregated Discord revenue reporting] | KOBA cosmetics are game-server-specific (nameplates/avatar decorations tied to Rust/Minecraft/etc. identity) vs. Discord's platform-wide cosmetics tied to a user's general Discord identity. | **Directionally validating, not directly competing.** Discord proves the "sell cheap pre-made cosmetic flair, no building required" model generates real, durable revenue at scale. It's not a head-to-head competitor since it isn't game-specific, but it's the strongest single proof-of-concept in this research for KOBA's cosmetics pillar specifically (see §4). |
| **Fiverr / Gumroad (freelance commission work)** | Marketplaces where a buyer can commission a *custom* map/mod/asset from a freelancer — closer to KOBA's Map Builder/dev-portal creator economy than to the pre-made cosmetics or trading-card marketplace. | KOBA's Product model is explicitly "sold pre-made, never buyer-configured" for cosmetics, and maps/monuments are listed as finished products, not commissioned — so Fiverr/Gumroad-style bespoke commission work is a genuinely different transaction shape. | **Low direct overlap**, but worth noting Fiverr/Gumroad prove there's *some* market for game-asset creator work being paid for in real money outside Steam/publisher channels — supporting evidence for creator willingness-to-sell (supply side), not buyer behavior for KOBA's specific pre-made/listing model. |

---

## 3. Biggest risks, bluntly

### (a) EULA / ToS / platform risk — real, and varies sharply by game

This is not a uniform risk across KOBA's game list — it ranges from
"explicitly sanctioned" to "actively routed through a specific
third-party partner that isn't KOBA" to "ambiguous."

- **Minecraft (Mojang):** EULA explicitly **prohibits selling in-game
  currency for real money** and requires that paid content not create a
  competitive advantage between paying and non-paying players
  ("pay-to-win" is banned). Cosmetic and social perks are the
  Mojang-sanctioned compliant path — which happens to match KOBA's
  cosmetics model reasonably well. Violating servers can be added to a
  connection-blocking blacklist. [Source: [Minecraft Usage
  Guidelines](https://www.minecraft.net/en-us/usage-guidelines), search-aggregated EULA reporting] KOBA facilitating trade of Minecraft
  **maps/mods for real money** sits in a greyer zone — BuiltByBit
  already operates exactly this at scale without apparent enforcement
  action, suggesting Mojang tolerates it in practice, but nothing found
  in this research is an explicit written carve-out for third-party
  real-money map/mod marketplaces the way the cosmetics/no-pay-to-win
  rule is explicit. **Moderate, largely precedent-mitigated risk.**

- **Rust (Facepunch):** Permanent-store items are explicitly
  **non-tradeable** by rule (cannot be resold on Steam Market, hold no
  resale value); only limited-time/drop-based skins are Steam-tradeable,
  and only via Steam's own market. [Source: [Facepunch permanent store
  news](https://rust.facepunch.com/news/permanent-store)] For KOBA's
  actual highest-value Rust use case — custom maps/monuments/plugins,
  not skins — there is direct, sustained, apparently-tolerated
  third-party precedent (Codefling, WeOxide, Lone.Design all operate
  openly). **Low-to-moderate risk for maps/monuments specifically;
  higher and largely pointless risk if KOBA tries to compete on
  Rust *skins*, where Steam's own market is the liquid, trusted venue
  and KOBA would be a weaker alternative, not filling a gap.**

- **ARK (Studio Wildcard):** CurseForge's ARK:SA moderation guidelines
  **explicitly prohibit any mod requiring a monetary transaction**
  except through the sanctioned "Premium Mods" program — which itself
  **requires creators to use a Tebex wallet**, the only approved payout
  method. [Source: [CurseForge ARK Premium Mods
  policy](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods)]
  This is the single clearest, most direct policy conflict found in this
  research: Wildcard has already picked a monetization partner for paid
  ARK mods, and it is not KOBA. Facilitating real-money ARK mod/asset
  trades outside that channel would plausibly violate Wildcard's own
  published terms. **Real, specific, sourced risk — highest of any game
  on KOBA's list.**

- **DayZ (Bohemia Interactive):** Bohemia has an official, published
  **server monetization policy** that explicitly allows charging for
  server access, cosmetic perks, and non-gameplay-affecting items —
  but explicitly **prohibits** selling in-game currency, weapons, ammo,
  vehicles, and other gameplay-affecting items, and this policy applies
  only to **private shard servers**, not the public hive or the DayZ
  mod. [Source: [Bohemia server monetization
  rules](https://www.bohemia.net/monetization/dev)] This is actually the
  **most explicit and KOBA-compatible** policy found in this research —
  it maps closely onto KOBA's cosmetics-only, no-pay-to-win design intent
  — but it's a narrow carve-out (private shards only) that KOBA would
  need to respect precisely.

- **Valheim, Conan Exiles, 7 Days to Die, Unturned, GMod, S&Box,
  Project Zomboid, Eco, Terraria, Starbound:** **not directly
  researched to primary-source ToS in this pass** — flagged as an open
  item. Given the pattern across the four games that *were* checked
  (ranging from explicit-and-compatible to explicit-and-conflicting),
  it would be a mistake to assume a uniform answer for the rest of the
  list; **each remaining title's EULA/ToS should be checked individually
  before launch**, not assumed compliant by analogy.

**Overall read on (a):** this is not a single yes/no answer — it's a
per-game compliance matrix, and at least one title on KOBA's flagship
list (ARK) has a specific, sourced conflict with KOBA's entire premise
for that game. This should be treated as an actual go/no-go gate
per-title, not a background legal footnote.

### (b) Liquidity / chicken-and-egg — evidence is mixed, leans favorable on supply, unproven on demand

**Supply side is well-evidenced.** Codefling (41K members), BuiltByBit,
CurseForge's 800M monthly downloads, and Tebex's $240M/year in creator
payouts all show there is a large, active population of creators already
producing and monetizing exactly this kind of content for exactly these
games. Bootstrapping *supply* is lower-risk than for a typical two-sided
marketplace — KOBA isn't asking anyone to create a new behavior, only to
list existing/equivalent work on a new venue, or import content from
where they already sell it.

**Demand side is the actual open question.** Every sourced revenue
figure in this research (Tebex, Discord, Codefling, BuiltByBit) is
revenue flowing to an *incumbent* that already has the buyer traffic —
none of it demonstrates that buyers will discover and transact on a
*new* venue with zero existing audience. KOBA's social/feed layer is the
proposed answer to this (discovery via following creators/shops, not
search-only), but that's an unproven mechanism for this specific
audience — there's no cited precedent in this research of a game-asset
marketplace successfully bootstrapping demand primarily through a social
feed rather than through SEO/community-forum discovery (which is how
Codefling, BuiltByBit, and CurseForge actually get found today). This is
the single largest unvalidated assumption in the whole product thesis.

### (c) Tebex/incumbent mindshare — a real switching-cost problem, not just competition

Tebex already has server-owner mindshare, tax compliance, chargeback
insurance, and 130+ payment methods built in — a server owner switching
to (or additionally maintaining) KOBA has to justify the operational
overhead of a second monetization system for arguably weaker guaranteed
traffic on day one. Codefling and BuiltByBit already have the
Rust/Minecraft creator communities' trust and SEO position for the
maps/plugins niche specifically. **What would make a creator choose KOBA
over Tebex or free CurseForge/Modrinth distribution:**
- Over Tebex: KOBA would need to offer *additional* buyer discovery
  Tebex doesn't provide (Tebex has no organic audience of its own; it's
  a checkout widget) — plausible in theory, unproven in practice per (b)
  above.
- Over free CurseForge/Modrinth: only if KOBA buyers are willing to pay
  for content that's otherwise available free/donation-based elsewhere —
  this is a real behavioral risk, not just a competitive one. CurseForge/
  Modrinth's own near-total avoidance of paid models despite 800M+
  monthly downloads (§2) suggests the *donation* model, not a locked
  paywall, may be the equilibrium buyers/creators have converged on for
  mods specifically (as opposed to skins/cosmetics, where Discord/Steam
  prove real willingness-to-pay exists).
- Over Codefling/BuiltByBit: KOBA would need to either undercut fees
  meaningfully (its 8%/4% vs. Codefling's flat 10% is a modest, not
  dramatic, edge for non-Blue-Badge sellers) or offer superior discovery
  — the same unproven bet as with Tebex.

---

## 4. Where the opportunity looks strongest / weakest

**Strongest evidence — cosmetics, Discord-Nitro-style model.** This is
the pillar with the clearest, most directly analogous proof point:
Discord's own cosmetics line does real, durable revenue (~10-15% of a
company doing well over $1B in overall revenue) with the exact
"pre-made, never built" mechanic KOBA has already committed to at the
schema level (Phase 3's enforced sub-type enum). It also sidesteps the
riskiest EULA territory — Minecraft, DayZ, and (implicitly) most other
titles' policies are explicitly *friendliest* to pure cosmetics with no
gameplay effect, which is the one category where KOBA's design intent
and every game's ToS posture point the same direction simultaneously.

**Second strongest — the maps/monuments/custom-content pillar, but
narrowed to Rust and Minecraft specifically, and priced/positioned as a
direct Codefling/BuiltByBit challenger, not a novel category.** There is
real, sustained precedent (Codefling, BuiltByBit) that a real-money
marketplace for exactly this content works at meaningful (if not huge)
scale for these two specific games. This is evidence *for* buildability,
not evidence that KOBA specifically will win share from entrenched
incumbents — the honest framing is "this is a viable niche with existing
winners," not "this is an underserved gap."

**Weakest — the ARK-inclusive framing of the marketplace pillar as
written.** Wildcard's explicit CurseForge/Tebex-routed premium-mod policy
is a sourced, specific conflict with KOBA facilitating ARK asset trades
outside that channel. Continuing to build ARK into the marketplace
pillar as scoped, without a legal review or a narrower ARK cosmetics-only
carve-out, is the single riskiest concrete decision surfaced in this
research.

**Also weaker, flagged as unproven rather than wrong — the social/feed
layer as the primary demand-generation mechanism.** It's the product's
most distinctive claimed differentiator versus Tebex/Codefling/
BuiltByBit, but it's also the piece with zero direct precedent in this
specific category (game-asset marketplaces) succeeding primarily through
social discovery rather than search/community-forum discovery. This
doesn't mean it won't work — but it's the part of the thesis resting most
heavily on the client's own instinct rather than researched evidence, and
should be treated as the biggest thing to validate cheaply and early
(e.g., via a small experiment — a `ab-test-setup`-style validation of
"does feed-driven discovery actually convert to a marketplace
transaction better than a search/browse-driven landing page" would be a
reasonable next step before over-investing in Phase 7/8's ad/feed
engine).

**Influencer/referral layer:** no direct evidence found either way in
this research pass — it's a reasonable growth-loop bet (referral
programs are well-precedented generally) but wasn't specifically
evidenced for this category; deferred rather than assessed here — a
dedicated `referral-program`-style pass would be the right way to
evaluate it specifically, separate from this general market-viability
question.

---

## 5. Bottom-line recommendation

**Proceed, but narrower than currently scoped — not "reconsider
entirely," and not "proceed as-is."**

The category is real (Tebex, Codefling, BuiltByBit, Discord cosmetics all
prove real money moves through exactly this kind of content, at scale
that ranges from meaningful-niche to very large depending on the game
and asset type). But "proceed as-is" — a single marketplace spanning
skins, maps, monuments, generic assets, and cosmetics across 14 PC
titles simultaneously, launching against entrenched per-game incumbents
on every single one of those titles, while also betting the core
discovery mechanism on an unproven social/feed layer — is a materially
higher-risk bet than the evidence supports for a first release.

**Recommended narrower wedge:**

1. **Lead with cosmetics (Avatar Decoration / Profile Effect / Nameplate)
   for 2-3 titles, not 14** — this is the pillar with the clearest
   analogue (Discord Nitro), the friendliest EULA posture across every
   game researched, and the schema is already built cleanly for it
   (Phase 3's enforced pre-made-only sub-type enum). Start with Rust and
   Minecraft specifically — the two titles with by far the largest
   active communities in this list and the most sourced precedent.
2. **Add maps/monuments for Rust specifically as the second pillar**,
   priced/positioned explicitly as a Codefling/BuiltByBit challenger
   (undercut on fee, differentiate on the social/follow-a-creator
   discovery layer as a genuine experiment, not an assumed win) — this
   is real, evidenced demand, just not a blue ocean.
3. **Hold ARK out of the marketplace pillar (or cosmetics-only) until a
   legal review resolves the CurseForge/Tebex premium-mod conflict** —
   this is the one sourced, specific policy risk found in this research
   and shouldn't be built past without a decision.
4. **Treat the remaining 10+ titles (DayZ, Conan Exiles, 7 Days to Die,
   Valheim, Unturned, GMod, S&Box, Project Zomboid, Eco, Terraria,
   Starbound) as a post-launch expansion list**, each requiring its own
   EULA/ToS check before marketplace (not just cosmetics) features go
   live for that title — don't assume compliance by analogy to the four
   games actually checked in this research.
5. **Validate the social/feed-as-discovery bet cheaply before over-building
   Phase 7/8** — e.g., a landing-page or waitlist test comparing
   feed-style browsing against a conventional search/category browse for
   the same catalog, before committing the full ads/feed engine build.

**What would change this recommendation:**
- **Toward "proceed as scoped":** direct evidence (even qualitative —
  waitlist signups, creator pre-commitments, a small pilot) that the
  social/feed discovery mechanism converts meaningfully better than
  search/browse for this specific buyer population, and a legal
  clearance on ARK's premium-mod conflict.
- **Toward "reconsider further":** if an early pilot on the Rust/
  Minecraft cosmetics-plus-maps wedge shows buyers default to Tebex-embedded
  checkout or Codefling/BuiltByBit out of habit even when KOBA's
  discovery/social layer is live and functioning — i.e., if the core bet
  that "discovery is the unlock" turns out false even in the narrowest,
  best-case test, that's a signal the marketplace pillar specifically
  (not just this scoping) needs to be rethought, separate from the
  cosmetics pillar, which has stronger standalone evidence regardless of
  how the marketplace pillar performs.

---

## Sources

- [SteamAnalyst — CS2 Skin Market Report 2025](https://www.steamanalyst.com/guides/cs2-market-report-2025)
- [PocketGamer.biz — Company Spotlight: Tebex](https://www.pocketgamer.biz/company-spotlight-tebex/)
- [Codefling — Become a Creator](https://codefling.com/creators/)
- [Codefling — homepage](https://codefling.com/)
- [BuiltByBit](https://builtbybit.com/)
- [Demandsage — Minecraft Statistics 2026](https://www.demandsage.com/minecraft-statistics/)
- [SteamDB — Rust charts](https://steamdb.info/app/252490/charts/)
- [PlayerAuctions — Rust live player count](https://www.playerauctions.com/player-count/rust/)
- [Facepunch — Permanent Store news](https://rust.facepunch.com/news/permanent-store)
- [SkinSwap — How to sell Rust skins for real money 2026](https://skinswap.com/blog/en/rust/how-to-sell-rust-skins-for-real-money-in-2026-the-complete-step-by-step-guide/)
- [GameDeveloper — Steam Workshop paid mods](https://www.gamedeveloper.com/business/game-mods-can-now-be-sold-on-the-steam-workshop-for-real-money)
- [CGChannel — Epic Games launches Fab marketplace](https://www.cgchannel.com/2024/10/epic-games-launches-its-new-fab-marketplace-in-october-2024/)
- [tech-insider.org — CurseForge vs Modrinth vs Nexus Mods 2026](https://tech-insider.org/ie/nexus-mods-vs-curseforge-vs-modrinth-2026/)
- [CurseForge Support — ARK Premium Mods policy](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods)
- [CurseForge Support — Moderation Guidelines for ARK Survival Ascended](https://support.curseforge.com/support/solutions/articles/9000232898-moderation-guidelines-for-ark-survival-ascended)
- [Minecraft — Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines)
- [Minecraft — EULA](https://www.minecraft.net/en-us/eula)
- [Bohemia Interactive — Server Monetization Rules (DayZ/Arma)](https://www.bohemia.net/monetization/dev)
- [Bohemia Interactive — Server Monetization FAQ](https://www.bohemia.net/monetization/faq)
- [PC Gamer — DayZ private server monetization](https://www.pcgamer.com/you-may-now-officially-monetize-your-private-dayz-server/)

Note: several figures (Discord Nitro/cosmetics revenue, ARK/DayZ/Conan
concurrent player counts, exact Codefling/BuiltByBit GMV) came from
search-engine-aggregated summaries rather than a single verifiable
primary document during this pass — flagged inline above where that
applies. Recommend a follow-up pass with direct primary-source
verification (Discord's actual investor/press disclosures, SteamDB raw
data) before using these specific numbers in an external-facing pitch
deck or investor document.
