# KOBA — Legal/ToS Review: ARK Deep-Dive + Per-Title Sweep

Research date: 2026-08-14. Executes two Validation Plan line items from
`unified-thesis.md` §6: "ARK legal review" (Flag #1, a blocker) and
"Per-title ToS sweep" (Flag #2, the 10 titles not yet individually
checked). This deepens and extends `market-research.md` §3(a) — it does
not repeat the Minecraft/Rust/DayZ findings already established there,
and only re-touches ARK because that's Part 1's explicit brief.

**Caveat that applies to this entire document, stated once up front:**
this is desk research (primary-source documents, official policy pages,
official developer statements), not legal counsel. Nothing below is a
substitute for an actual attorney reviewing KOBA's specific transaction
flow against each publisher's current terms before launch. Several
titles below are explicitly marked "needs actual legal counsel" for
exactly this reason.

---

## Part 1 — ARK Legal Review (deep-dive)

### 1a. Primary-source text, quoted directly

**CurseForge's ARK Premium Mods policy** (the specific FAQ page governing
paid mods):
> "Premium mods for ARK SA can only be sold through CurseForge. You are
> not allowed to sell your premium mods on your own, nor through any
> other third-party vendor."

> "No you cannot. Premium mod authors must have a Tebex wallet. This is
> the only method to get paid for your premium mods."

> "You will receive your payout on a monthly basis in a net 60 manner.
> For example, every mod purchase made in January, will be paid to you
> by the end of February."

> "Currently no. The only game on CurseForge with premium mods is ARK:
> Survival Ascended."
[Source](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods)

**CurseForge's ARK:SA Moderation Guidelines** (the document that actually
establishes whose rule this is):
> "Any mod that involves any monetary transaction in order to acquire,
> operate or function with full features is not allowed." (stated
> separately for PC/Windows, Xbox Series X/S, and PS5)

> "Any shop/market mod that allows purchasing of mods, items, or other
> features in a server for either direct payment or via virtual currency"
> is prohibited.

> "To the extent these Moderation Guidelines conflict with CurseForge's
> moderation guidelines and/or policies, the Moderation Guidelines in
> this document will take precedent."
[Source](https://support.curseforge.com/support/solutions/articles/9000232898-moderation-guidelines-for-ark-survival-ascended)

That last clause is the load-bearing sentence for the risk-attribution
question below: this document is explicitly framed as **Studio
Wildcard's own moderation requirements for their game**, hosted on
CurseForge's infrastructure, and it overrides CurseForge's own default
policy where the two conflict. It is not CurseForge inventing a
platform-specific rule Wildcard is indifferent to.

**ARK's Code of Conduct** (survivetheark.com/support, applies to
official/BattlEye-protected servers):
> "ARK items, creatures, or services must only be exchanged for other
> items, creatures, or services within the game. Trading for real-world
> currency (real money) is not an accepted form of trading."

> Real Money Trading is listed among violations "that may not be
> appealed," alongside hacking, exploiting, and meshing. "Servers found
> advertising real-money trades or real-money purchases are subject to
> termination without warning."
[Source](https://support.survivetheark.com/hc/en-us/articles/220278968-Code-of-Conduct)

Note the scope on this last one: it's explicitly about the **Official
Network** (Wildcard-hosted official servers), not a blanket rule against
all private servers everywhere — this is the RMT-of-in-game-items rule,
separate from (and narrower in scope than) the mod-monetization rule
above.

### 1b. Whose rule is this — Wildcard's or just CurseForge's?

**This is Wildcard's rule, not just CurseForge's.** The moderation
guidelines document is explicit that it's Studio Wildcard's own
requirement, presented *through* CurseForge, and that it overrides
CurseForge's generic policy when the two disagree. This matters for risk
level: it is not a case of "a distribution platform enforcing a rule the
publisher is indifferent to outside that channel" (the narrower, lower-risk
reading market-research.md's phrasing left open). Wildcard picked Tebex as
the exclusive payout rail for monetized ARK:SA mods and wrote that choice
into guidelines it authored. A KOBA facilitating an ARK:SA asset trade
outside CurseForge/Tebex would be violating Wildcard's stated policy
directly, not merely stepping outside one distribution channel's local
rules while remaining fine everywhere else. **Risk level: high, not
narrow** — this reverses the more optimistic reading that was still open
in market-research.md.

There is a genuine practical caveat, though: this guideline as written
is a **CurseForge-hosted-mod-specific** requirement (it governs mods
distributed through CurseForge, since "the only game on CurseForge with
premium mods is ARK: Survival Ascended"). It does not, on its face, reach
a hypothetical KOBA marketplace listing that is not a CurseForge mod at
all — e.g., a cosmetic skin pack, a save-game/world file, or a
custom map bundle sold and delivered entirely outside CurseForge's mod
pipeline. No text was found that extends Wildcard's Tebex requirement to
content sold completely outside the CurseForge distribution surface.
That said, this is a thin distinction to build a business decision on: it
depends on whether what KOBA calls an "asset" for ARK is, in substance,
a mod (subject to CurseForge/Tebex) or something else — and Wildcard's
Code of Conduct RMT ban (1a, third quote) is broader and would still
reach real-money item/creature trading regardless of delivery mechanism,
at least on official servers.

### 1c. ARK: Survival Evolved (the older title) — same or different?

**Materially different, and less restrictive on the mod-monetization
axis specifically.** CurseForge confirms directly: "the only game on
CurseForge with premium mods is ARK: Survival Ascended" — meaning the
Tebex-wallet-only Premium Mods requirement **does not apply to ARK:
Survival Evolved at all**, because ASE mods are distributed primarily
through Steam Workshop, not CurseForge's premium-mod pipeline, and no
CurseForge premium-mods program exists for ASE.

However, ASE is **not therefore clear**:
- The same Code of Conduct RMT ban found for ASA appears to be a
  shared, studio-wide policy applying to "the Official Network" across
  ARK titles (Steam's 2018-era "Overseer's Code of Conduct" announcement
  for ARK: Survival Evolved covers the same real-money-trading
  prohibition). This wasn't found as a *title-specific* separate ASE
  document, so treat the RMT-on-official-servers ban as applying to ASE
  too, with the caveat that it's explicitly about official servers, not
  a blanket ban on private-server economies.
- No dedicated "ASE Premium Mods"-style monetization program or
  published private-server monetization policy (the DayZ-style explicit
  carve-out) was found for ASE. Silence here is not evidence of
  permission — see the report-wide caveat.

**Net: ASE is lower-risk than ASA specifically because the Tebex/
CurseForge conflict doesn't apply to it, but it is not a cleared "safe"
title — it's an unresolved one**, with only a general (and narrower in
scope) RMT-on-official-servers prohibition found, nothing that
affirmatively sanctions private real-money trading of ASE mods/assets.

### 1d. Does the Tebex-routing "fix" even work for KOBA's architecture?

Market-research.md's framing left "route ARK payouts through Tebex" on
the table as a hypothetical compliance path. It is not viable as a
patch:

- KOBA's payments architecture (per `unified-thesis.md` §3, §4) is built
  on **Stripe Connect** for seller payouts. Tebex requires creators to
  hold and be paid out via a **Tebex wallet** specifically — this is a
  parallel, mutually exclusive payment rail, not a Stripe-compatible
  option. There's no way to satisfy "creator gets paid via Tebex wallet"
  through a Stripe Connect payout without literally standing up a
  second, separate Tebex integration purely for ARK sellers.
- Even if KOBA built that integration, it wouldn't make KOBA "the
  marketplace" for ARK in any meaningful sense — CurseForge would still
  be the mandatory point of sale/distribution ("can only be sold through
  CurseForge... not through any other third-party vendor"). KOBA could
  at best become a discovery/referral layer pointing buyers to
  CurseForge, not a transacting marketplace — which defeats the actual
  product thesis (KOBA facilitating the trade, taking a platform fee) for
  this title specifically.
- **Conclusion: the Tebex-routing compliance path is a structural
  contradiction with KOBA's own architecture, not a workaround.**
  Building it would mean maintaining a second payments system for one
  title's mod category, for a product where KOBA still couldn't actually
  be the marketplace of record.

### 1e. Recommendation

| Scope | Recommendation |
|---|---|
| ARK: Survival Ascended — marketplace listings of paid mods/CurseForge content | **Full exclusion.** Direct, sourced conflict with Wildcard's own stated policy; no compliant path compatible with KOBA's Stripe Connect architecture exists. |
| ARK: Survival Ascended — cosmetics that are not CurseForge mods (e.g., a cosmetic skin pack sold and delivered entirely outside CurseForge) | **Cosmetics-only inclusion is a plausible narrower path, not a cleared one.** The Tebex/CurseForge requirement is scoped to CurseForge-distributed mods; it's not clearly established that a non-CurseForge cosmetic item is caught by it. But Wildcard's Code of Conduct RMT ban is broader in scope and could still reach real-money item trading depending on how "item" is defined and whether it touches official servers. **Needs actual legal counsel before treating this as safe** — this is a genuine gap in the desk research, not a green light. |
| ARK: Survival Evolved (ASE) | **Unresolved, not cleared.** Lower-risk than ASA on the specific Tebex/CurseForge axis (that policy doesn't apply to ASE), but no explicit private-server monetization sanction was found either — silence, not permission. Recommend the same "needs legal counsel before non-cosmetics inclusion" treatment as ASA's cosmetics carve-out, one tier less urgent. |
| Both ARK titles — full marketplace inclusion (maps/mods/assets as scoped in the original 14-title plan) | **No-go.** Confirmed by this deeper review, not weakened — if anything the "whose rule is this" analysis (§1b) makes the risk *higher* than market-research.md's initial framing left open, since this is Wildcard's rule, not a narrow CurseForge-only channel restriction. |

---

## Part 2 — Per-Title ToS Sweep (10 titles)

### Valheim (Iron Gate / Coffee Stain)

- **RMT of items/currency:** No specific clause found — Valheim has no
  official in-game currency or tradeable-item economy to regulate; the
  question doesn't cleanly apply the way it does for a survival-server
  economy game.
- **Selling custom server content/mods for real money:** **Explicit
  prohibition**, via an official Iron Gate Steam news post ("Regarding
  Mods," May 2023), not a formal EULA clause but a direct, official,
  attributable developer policy statement: charging money for a mod is
  "against the creative and open spirit of modding itself," and Iron
  Gate does not want "payment to be a requirement to access a mod" —
  voluntary donations are the sanctioned model instead. [PC
  Gamer](https://www.pcgamer.com/valheim-developer-believes-paid-mods-are-against-the-creative-and-open-spirit-of-modding/),
  [GameSpot](https://www.gamespot.com/articles/valheim-developers-say-paid-mods-are-against-the-open-and-creative-spirit-of-modding-itself/1100-6514642/)
- **Cosmetics-only on private servers:** EULA permits monetizing
  gameplay video content (Twitch/YouTube ads, Patreon-exclusive video
  content) but has no clause addressing in-game cosmetic sales one way
  or the other. [Source](https://www.valheimgame.com/eula/)
- **Third-party partner requirement/prohibition:** None found.
- **Classification: conflicting** (for mods/maps — direct, official,
  on-the-record developer statement against paid mods) — **unresolved**
  for cosmetics specifically, since Valheim has no official server
  cosmetics/perks system this would map onto in the first place.

### Conan Exiles (Funcom)

- **RMT of items/currency:** **Explicit prohibition.** Funcom's EULA
  ("DA EULA," applies to "each of our Games," Conan Exiles listed among
  them, no title-specific carve-out found): "sell, rent, lease, license,
  distribute, or otherwise transfer the Services, Game or any Content,
  including... Virtual Goods or Game Currency, including participating
  in or operating so called 'secondary markets'" is prohibited; "VIRTUAL
  GOODS AND GAME CURRENCY HAVE NO MONETARY VALUE AND CANNOT BE REDEEMED
  FOR CASH... ARE NON-TRANSFERABLE AND NON-TRADABLE." A separate,
  earlier-sourced Funcom ToS states directly: "You may not sell in-Game
  items or currency for 'real' money... without the express written
  permission of Funcom." [Source](https://www.funcom.com/da-eula-en-us/)
- **Selling custom content/mods:** Modding itself requires "express
  written consent of Funcom" per Funcom's general ToS language found for
  their titles; no sanctioned paid-mod program found for Conan Exiles
  specifically.
- **Cosmetics-only on private servers:** No explicit carve-out found
  either permitting or prohibiting pure-cosmetic private-server sales
  specifically (as distinct from the general RMT/secondary-market ban
  above, which is broad enough to plausibly reach cosmetics too).
- **Third-party partner requirement:** None found.
- **Classification: conflicting.** Explicit, sourced, broadly-worded RMT
  and secondary-market prohibition with no cosmetics carve-out found —
  the opposite posture from DayZ's explicit private-server cosmetics
  allowance.

### 7 Days to Die (The Fun Pimps / TFP)

- **RMT / server monetization:** **Explicit and specific.** 7DTD's EULA:
  "Server owners MAY NOT charge hard currency (tangible money such as
  cash, credit, bitcoin, or other currency fiat etc. that has monetary
  value or may be exchanged for money) or soft currency (in game
  currency that has no monetary value) or in game items. Server owners
  MAY allow priority access to players that make a donation."
  [Source](https://store.steampowered.com/eula/251570_eula_0)
- **Selling custom server content/mods:** Not separately addressed, but
  the blanket "may not charge... currency or items" language is broad
  enough to plausibly cover paid custom content/cosmetics sold to
  players, not just server-access fees.
- **Cosmetics-only on private servers:** The donation-only model (with
  optional priority-access perks tied to donation, not direct purchase)
  is the sanctioned path — a straight-purchase cosmetic storefront (what
  KOBA's model requires) does not clearly fit "donation."
- **Third-party partner requirement:** None found.
- **Classification: conflicting.** This is one of the most explicit,
  specific prohibitions found in this entire sweep — closer in bluntness
  to Minecraft's currency-sale ban than to DayZ's permissive stance, and
  it's not narrowed to just currency (covers items too).

### Unturned (Smartly Dressed Games)

- **RMT of items/currency:** Vanilla premium content (Gold Upgrade
  benefits, official cosmetics/skins) explicitly **may not** be resold
  or offered for real money by servers: "Servers are not allowed to sell
  or otherwise offer access to vanilla premium content. This includes
  the Gold Upgrade benefits in addition to any vanilla cosmetics and/or
  skins."
- **Selling custom server content for real money:** **Explicitly
  permitted**, if the server owns/licenses the content: "When offering
  cosmetic perks to players as a microtransaction, the server should own
  (or have licensed) the rights to that content. For example, you could
  create your own custom 'cosmetics' and offer those to players
  instead." [Source: Smartly Dressed Games' official Server Hosting
  Rules](https://docs.smartlydressedgames.com/en/stable/servers/server-hosting-rules.html)
- **Cosmetics-only on private servers:** Directly sanctioned, as above,
  provided the cosmetic is custom/licensed rather than official/vanilla
  content.
- **Third-party partner requirement:** None found.
- **Classification: compatible**, with a specific, documented caveat:
  KOBA-facilitated Unturned cosmetics must be custom content the seller
  actually owns/has licensed — official vanilla skins/Gold Upgrade
  content cannot be resold. This is the second-friendliest policy found
  in the entire 14-title set (after DayZ), and it maps almost exactly
  onto KOBA's "pre-made, seller-owned cosmetic" model.

### Garry's Mod (Facepunch)

- **RMT of items/currency:** No formal in-game currency/tradeable-item
  system to regulate in the same sense as a survival-server economy
  game.
- **Selling custom server content/mods for real money:** **Explicitly
  permitted**, directly from Facepunch's own modding guidelines: "Can I
  sell a Mod I own? Yes." The same document explicitly states it applies
  to "Garry's Mod, Rust, Clatter, Chippy, Facepunch prototype games as
  well as our other games, services and products."
  [Source](https://facepunch.com/legal/modding) (Steam Workshop
  specifically prohibits *paywalling* Workshop-distributed addons —
  "Malicious Code" rules bar blocking non-payers from using an addon —
  but this is a Workshop-channel-specific restriction, not a ban on
  selling mods through other channels; the long-running, openly-operated
  third-party marketplace [gmodstore.com](https://www.gmodstore.com/)
  — 800+ paid scripts, 110K+ registered users — is consistent
  real-world precedent that off-Workshop paid addon sales are tolerated
  in practice.)
- **Cosmetics-only on private servers:** **Explicitly permitted**, from
  Facepunch's own server guidelines: "Yes, you are allowed to monetise
  your Servers, for example: (a) charge either a single fee or
  subscription for use of your Servers; (b) accept donations; (c) sell
  cosmetic items, effects or enhancements; (d) your own Server currency;
  and/or (e) have adverts, sponsorships or product placements."
  [Source](https://facepunch.com/legal/servers)
- **Third-party partner requirement:** None found — no Tebex-style
  routing mandate, unlike ARK.
- **Classification: compatible.** This is the single most explicit,
  affirmative "yes" found for any title in this sweep — Facepunch
  states directly, in its own first-party legal documentation, both
  that mods can be sold and that server cosmetics can be sold.

### S&Box (Facepunch)

- **Consistency check requested by the task: is Facepunch's policy
  consistent across Rust and GMod vs. S&Box?** Partially — the general
  Facepunch modding/server guidelines above (facepunch.com/legal/modding,
  /servers) are written to cover "our other games, services and
  products" broadly, and the servers document names s&box in its scope.
  But S&Box also has its **own, separate EULA** with its own
  monetization model layered on top.
- **RMT of items/currency:** S&Box's own EULA restricts *Facepunch's*
  own Virtual Goods specifically: they "cannot be 'bought', 'sold',
  gifted, transferred, traded or redeemed in any way." This is about
  Facepunch's first-party store items, not user-created content.
  [Source](https://facepunch.com/legal/sbox/eula)
- **Selling custom content ("Experiences")/mods for real money:** S&Box's
  actual monetization model is **The Play Fund** — a Facepunch-operated,
  Facepunch-discretionary payout pool (seeded from Garry's Mod profits,
  reportedly $500K+ paid to creators to date per PC Gamer reporting) that
  pays creators based on player engagement with their Experiences, not a
  direct pay-to-access storefront. The S&Box EULA does not explicitly
  prohibit external monetization of creator content, but the entire
  product design funnels monetization through Facepunch's own Play Fund
  rather than a direct-purchase model.
- **Cosmetics-only on private servers:** Not clearly addressed
  separately from the above.
- **Third-party partner requirement:** No explicit prohibition of
  third-party sales found, but no explicit sanction either — this is
  genuinely a different monetization shape (engagement-based payout pool)
  than KOBA's direct-purchase marketplace model, which creates ambiguity
  the desk research can't resolve.
- **Classification: unresolved.** Not a sourced conflict the way ARK or
  Conan Exiles are, but S&Box's whole monetization architecture (Play
  Fund) is structurally different from a direct-sale marketplace in a
  way that raises the same "is this even the right distribution model"
  question ARK's Tebex requirement raises, just without an explicit
  prohibition backing it up. Recommend treating as needing actual legal
  counsel before any S&Box marketplace listing, not desk-research
  clearance.

### Project Zomboid (The Indie Stone)

- **RMT / mod monetization:** **Explicit and blanket prohibition**, per
  The Indie Stone's own modding policy (search-aggregated, primary page
  at projectzomboid.com/blog/modding-policy/ returned a 403 during this
  research pass and could not be directly quoted — treat the following
  as sourced from secondary reporting of that policy, not a direct
  primary-source quote): The Indie Stone does not approve of monetizing
  any aspect of the game and does not allow mods to be sold without
  their prior approval; server owners are explicitly told not to charge
  for specific items, mods, or gameplay content made exclusively for
  their server. Donations directly to modders are the one sanctioned
  exception.
- **Cosmetics-only on private servers:** No carve-out found for pure
  cosmetics distinct from the general no-monetization stance — the
  policy as reported is blanket, not scoped to gameplay-affecting
  content only (unlike DayZ's model).
- **Third-party partner requirement:** None found.
- **Classification: conflicting.** One of the strictest policies found
  in this sweep. **Caveat:** the primary source page itself couldn't be
  fetched directly in this pass (blocked); this classification rests on
  consistent secondary reporting of that policy's contents, not a
  first-hand quote — flagged so it can be re-verified against the actual
  page text before being treated as fully confirmed.

### Eco (Strange Loop Games)

- **RMT of items/currency:** No explicit clause found prohibiting or
  permitting real-money trading of Eco's in-game currency by third
  parties. Eco's own EULA (accounts.strangeloopgames.com/terms/eula, not
  directly fetchable in this pass — DNS/403 errors) is only known
  secondhand: it addresses IP ownership of uploaded mod content and a
  liability disclaimer for "virtual goods or currency," not a real-money
  sale prohibition specifically.
- **Selling custom content/mods:** Eco has its own first-party
  "Registered Mods" system where mods registered by Strange Loop
  automatically earn **in-game Eco Credits** (not real money) whenever a
  world spends credits using them — this is explicitly *not* a real
  revenue-share mechanism (per Strange Loop's own CEO commentary: "no
  real revenue sharing with Eco Credits, and there is no way to redeem
  virtual currency"). This tells us Strange Loop has built an in-game
  compensation system as their sanctioned path, but it doesn't tell us
  whether third-party real-money sales of Eco mods/maps outside that
  system are prohibited or merely undiscussed.
- **Cosmetics-only on private servers:** No policy found either way.
- **Third-party partner requirement:** None found.
- **Classification: unresolved.** Genuinely no clear public policy found
  on real-money sales of custom Eco content by third parties — the
  existence of an official in-kind (non-cash) mod-compensation system is
  suggestive of Strange Loop's general posture but is not itself a
  prohibition or permission on KOBA's specific model. Don't infer either
  way.

### Terraria (Re-Logic)

- **RMT / mod monetization:** **No clear published policy found.**
  tModLoader's Terms of Service (the officially Re-Logic-endorsed modding
  framework) addresses IP infringement on the Mod Browser but contains
  no explicit clause permitting or prohibiting charging money for mods.
  [Source](https://store.steampowered.com/eula/1281930_eula_0)
  General reporting establishes Re-Logic has a *permissive, pro-modding*
  reputation (explicitly cited as one of the industry's few developers
  actively encouraging modding) and has publicly framed continued
  Terraria updates as funded by base-game sales rather than
  microtransactions — but this is a general company posture, not a
  specific statement about third-party real-money mod/map sales, and
  should not be read as an affirmative policy either way.
- **Cosmetics-only on private servers / server monetization generally:**
  No policy found — Terraria's dedicated-server model doesn't have the
  same kind of official server-monetization framework the survival-genre
  titles above do.
- **Third-party partner requirement:** None found.
- **Classification: unresolved — explicitly.** This is a case where "no
  policy found" should not be read as safe-by-silence. Re-Logic's
  general pro-modder reputation makes this feel lower-risk than Conan
  Exiles or 7 Days to Die, but that's a vibe, not a sourced policy —
  flagged accordingly rather than inferred.

### Starbound (Chucklefish)

- **RMT / mod monetization:** Chucklefish's own Mod Terms address IP and
  distribution rights but are **silent on real-money sales of mods** by
  the creator to end users. The terms do grant Chucklefish itself an
  "exclusive... right and licence... to make commercial use of your Mod
  in connection with physical products" (i.e., merchandise), which
  implies Chucklefish reserves *physical* commercialization rights to
  itself, but says nothing about a modder selling a digital copy of
  their own mod to players. [Source](https://community.playstarbound.com/help/mod-terms/)
- **Cosmetics-only on private servers:** No policy found.
- **Third-party partner requirement:** None found.
- **Classification: unresolved.** Genuinely no clear published stance on
  digital real-money mod sales either way — flagged as undetermined, not
  inferred safe from Chucklefish's general silence or Terraria's
  more-permissive reputation (a different studio, no basis for analogy).

---

## Summary Table — All 14 Titles

| Title | Publisher | Classification | One-line reason | Source |
|---|---|---|---|---|
| Minecraft | Mojang | **Compatible** (cosmetics), **grey zone** (maps/mods) | EULA bans currency-for-cash and pay-to-win explicitly; cosmetics/social perks are the sanctioned path; maps/mods for money tolerated in practice (BuiltByBit) but no explicit written carve-out | [Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) |
| Rust | Facepunch | **Compatible** | Permanent-store items non-tradeable by rule (skins out of scope), but server cosmetics/maps/monuments explicitly sanctioned; direct real-world precedent (Codefling) | [Facepunch legal/servers](https://facepunch.com/legal/servers), [Facepunch legal/modding](https://facepunch.com/legal/modding) |
| ARK: Survival Ascended | Studio Wildcard | **Conflicting** | Wildcard's own moderation guidelines mandate Tebex-wallet-only payout for monetized mods via CurseForge; incompatible with KOBA's Stripe Connect architecture | [CurseForge ARK Premium Mods](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods) |
| ARK: Survival Evolved | Studio Wildcard | **Unresolved** (lower risk than ASA, not cleared) | Tebex/CurseForge premium-mod requirement doesn't apply (ASA-only), but no affirmative private-server RMT sanction found either; official-server RMT ban applies | [CurseForge FAQ](https://support.curseforge.com/support/solutions/articles/9000235469-ark-premium-mods), [ARK Code of Conduct](https://support.survivetheark.com/hc/en-us/articles/220278968-Code-of-Conduct) |
| DayZ | Bohemia Interactive | **Compatible** | Explicit official server monetization policy allowing cosmetics/perks on private shards, banning gameplay-affecting items/currency | [Bohemia server monetization rules](https://www.bohemia.net/monetization/dev) |
| Valheim | Iron Gate/Coffee Stain | **Conflicting** (mods/maps), **unresolved** (cosmetics — no applicable system) | Official Iron Gate Steam post explicitly opposes paid mods; no server-cosmetics system exists to map KOBA's cosmetics pillar onto | [PC Gamer](https://www.pcgamer.com/valheim-developer-believes-paid-mods-are-against-the-creative-and-open-spirit-of-modding/) |
| Conan Exiles | Funcom | **Conflicting** | Funcom EULA explicitly bans selling Virtual Goods/Game Currency and "secondary markets," no cosmetics carve-out found | [Funcom EULA](https://www.funcom.com/da-eula-en-us/) |
| 7 Days to Die | The Fun Pimps | **Conflicting** | EULA explicitly bars server owners from charging hard/soft currency or items; donation-only model sanctioned | [Steam EULA](https://store.steampowered.com/eula/251570_eula_0) |
| Unturned | Smartly Dressed Games | **Compatible** (with caveat) | Official server hosting rules explicitly permit selling custom/licensed cosmetics; vanilla/official content resale explicitly barred | [SDG Server Hosting Rules](https://docs.smartlydressedgames.com/en/stable/servers/server-hosting-rules.html) |
| Garry's Mod | Facepunch | **Compatible** | Facepunch's own legal docs state directly "Can I sell a Mod I own? Yes," and server cosmetic sales explicitly permitted | [Facepunch legal/modding](https://facepunch.com/legal/modding), [Facepunch legal/servers](https://facepunch.com/legal/servers) |
| S&Box | Facepunch | **Unresolved** | Covered nominally by Facepunch's general modding/server policy, but S&Box's own Play Fund monetization model is structurally different from direct-sale, creating ambiguity no explicit clause resolves | [S&Box EULA](https://facepunch.com/legal/sbox/eula) |
| Project Zomboid | The Indie Stone | **Conflicting** | Blanket no-monetization-of-mods policy per Indie Stone's modding policy (secondary-sourced — primary page blocked, see caveat above) | [Modding policy, secondary-sourced](https://projectzomboid.com/blog/modding-policy/) |
| Eco | Strange Loop Games | **Unresolved** | No clear public policy on third-party real-money content sales; official in-game (non-cash) Eco Credits system exists but doesn't resolve the question either way | [Registered Mods](https://wiki.play.eco/en/Registered_Mods) |
| Terraria | Re-Logic | **Unresolved — explicitly** | No published policy found on real-money mod/map sales; general pro-modding reputation is not a sourced policy | [tModLoader ToS](https://store.steampowered.com/eula/1281930_eula_0) |
| Starbound | Chucklefish | **Unresolved** | Chucklefish's Mod Terms are silent on digital real-money mod sales by creators | [Chucklefish Mod Terms](https://community.playstarbound.com/help/mod-terms/) |

---

## Go/No-Go by Title

**Safe to include in the marketplace pillar (maps/mods/custom content)
at launch:**
- **Rust** — already the flagship wedge per `unified-thesis.md` §4;
  confirmed compatible, no change from prior research.
- **Garry's Mod** — newly confirmed as the most explicitly compatible
  title in this sweep (Facepunch's own "Can I sell a Mod I own? Yes").
  Worth flagging as a candidate to promote alongside Rust/Minecraft in
  the wedge sequence, given how unambiguous this one is relative to
  everything else checked.

**Cosmetics-only (do not include maps/mods/custom paid content):**
- **Minecraft** — per existing research, cosmetics/social perks are the
  sanctioned path; maps/mods remain a tolerated-not-explicit grey zone.
- **Unturned** — cosmetics explicitly sanctioned if custom/licensed
  (not vanilla); no equivalent sanction found for other content types.
- **DayZ** — per existing research, cosmetics/perks on private shards
  only.

**Excluded entirely (do not include in any form pending resolution):**
- **ARK: Survival Ascended** — confirmed blocker; no compliant path
  compatible with KOBA's Stripe Connect architecture exists.
- **Conan Exiles** — explicit, broadly-worded RMT/secondary-market ban.
- **7 Days to Die** — explicit, specific ban on server owners charging
  currency or items for anything beyond donations.
- **Project Zomboid** — blanket no-mod-monetization policy (with the
  primary-source caveat noted above).
- **Valheim** — official developer statement directly opposing paid
  mods; no server-cosmetics system exists to fall back to.

**Needs actual legal counsel before any decision (desk research
genuinely insufficient, not just cautious):**
- **ARK: Survival Evolved** — narrower risk than ASA, but not cleared;
  a lawyer should confirm whether the general RMT Code of Conduct
  reaches private/unofficial servers before treating any ASE inclusion
  as safe.
- **S&Box** — the Play Fund's structural difference from a direct-sale
  marketplace is a real open question, not just an absence of a written
  rule; this needs a judgment call informed by counsel, not desk
  research, before any listing.
- **Eco, Terraria, Starbound** — genuinely no public policy found
  either direction. Silence should not be treated as permission; if any
  of these are prioritized for the expansion list ahead of the others,
  get counsel to reach out to the publisher directly (Re-Logic and
  Strange Loop Games in particular both have public reputations for
  being modder-friendly and responsive — a direct clarifying question is
  plausible and cheap relative to guessing) rather than launching on an
  absence-of-evidence assumption.

**Explicit flag, per the task's requirement:** Eco, Terraria, Starbound,
and S&Box are titles where **no clear public policy was found** on the
core question (real-money sale of custom content/mods). This is stated
here as an open unknown, not as an implicit "probably fine" — do not
carry these forward into the marketplace pillar on the basis of this
document alone.

---

## What changed vs. `market-research.md` §3(a) and `unified-thesis.md` §2

- **ARK risk level revised upward, not down.** The "is this Wildcard's
  rule or just CurseForge's" question genuinely mattered, and the answer
  (§1b) is that it's Wildcard's rule, enforced through but not limited
  to CurseForge's channel — the more optimistic "narrower, CurseForge-only"
  reading is not supported by the primary-source text.
- **The Tebex-routing "fix" floated as a hypothetical in the unified
  thesis is confirmed non-viable** (§1d) — it conflicts with KOBA's
  Stripe Connect architecture and wouldn't make KOBA the transacting
  marketplace even if built.
- **Garry's Mod is the most clearly compatible title found in this
  entire research pass** (more explicit than Rust, DayZ, or Unturned) —
  worth the product team's attention as a possible wedge addition, not
  just a background "also checked" data point.
- **Four titles (Eco, Terraria, Starbound, S&Box) remain genuinely
  undetermined** even after this pass — this document does not close
  Flag #2 to zero, it reduces it from "10 titles fully unchecked" to "6
  titles resolved (2 compatible, 4 conflicting), 4 titles confirmed as
  requiring direct publisher contact or legal counsel, not further desk
  research."
