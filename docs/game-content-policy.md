# Per-game marketplace content policy

Source: "KOBA — Legal/ToS Review: ARK Deep-Dive + Per-Title Sweep"
(2026-08-14), executing Validation Plan items from unified-thesis.md §6.
**Desk research, not legal counsel** — primary-source documents and
official developer statements, not an attorney reviewing KOBA's specific
transaction flow. Several titles are explicitly blocked pending actual
counsel, not cleared by this document.

This applies only to **marketplace `Product` listings** (mods, maps,
kits, and in-game skins — anything with a `gameId`). It has nothing to do
with the separate platform-level `Cosmetic` model (avatar decorations,
profile effects, nameplates, profile frames, shop banners, emojis — KOBA's
own subscription-style profile/shop customization, scoped to a `Shop`, not
a game, and purchased in USD, not KOBA Coins). Those are enforced
independently and this policy never touches that table.

## Enforcement

`Game.contentPolicy` (`GameContentPolicy` enum) + `Game.policyNote`
(human-readable citation). Checked by
`features/marketplace/lib/game-policy.ts#isListingAllowedForGame`, wired
into `features/shops/services/product-admin.service.ts` at three points:
`createSellerProduct`, `updateSellerProduct` (fail fast, good UX), and
`staffApproveProduct` (defense in depth — catches a game whose policy
tightened after a listing was already drafted).

| Policy         | Meaning                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `FULL`         | Mods/maps/kits/skins all allowed.                                                                                                          |
| `SKINS_ONLY`   | Only `Category.kind = SKINS` listings allowed — in-game character/item skins (a Minecraft cape, a DayZ clothing item), not mods/maps/kits. |
| `EXCLUDED`     | No listings of any kind — sourced, direct conflict with the publisher's stated policy.                                                     |
| `LEGAL_REVIEW` | No public policy found either direction. Blocked pending actual legal counsel or direct publisher contact — silence is not permission.     |

## Current classifications

| Game                   | Policy       | Why                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust                   | `FULL`       | Already the flagship wedge — confirmed compatible (Facepunch legal/servers, legal/modding).                                                                                                                                                                                                                                                                                                          |
| Garry's Mod            | `FULL`       | Newly added. Facepunch's own legal docs: "Can I sell a Mod I own? Yes" — server cosmetic/skin sales explicitly permitted too. The most explicitly compatible title found in the whole sweep.                                                                                                                                                                                                         |
| Minecraft              | `SKINS_ONLY` | EULA bans currency-for-cash/pay-to-win; in-game cosmetic perks (skins) are the sanctioned path. Maps/mods remain a tolerated-not-explicit grey zone — not upgraded to `FULL` on that basis.                                                                                                                                                                                                          |
| DayZ                   | `SKINS_ONLY` | Official Bohemia server monetization policy: cosmetics/perks on private shards only.                                                                                                                                                                                                                                                                                                                 |
| ARK: Survival Ascended | `EXCLUDED`   | Wildcard's own CurseForge moderation guidelines mandate Tebex-wallet-only payout for monetized mods — a direct conflict with KOBA's Stripe Connect architecture, and Wildcard's rule, not just CurseForge's. No compliant path found, including for skins (the narrower skins-outside-CurseForge reading is a "needs legal counsel" question, not a clearance — treated as excluded until resolved). |
| Conan Exiles           | `EXCLUDED`   | Funcom EULA explicitly bans selling Virtual Goods/Game Currency and "secondary markets," no cosmetics/skins carve-out found.                                                                                                                                                                                                                                                                         |
| Valheim                | `EXCLUDED`   | Official Iron Gate developer statement directly opposes paid mods; no server-cosmetics system exists as a fallback.                                                                                                                                                                                                                                                                                  |

Not yet seeded, held pending resolution (do not add without one of these first):

| Game                           | Status                                         | Why                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARK: Survival Evolved          | Needs legal counsel                            | Lower risk than ASA (the Tebex/CurseForge requirement is ASA-only), but no affirmative private-server RMT sanction found either.                                                                                    |
| S&Box                          | Needs legal counsel                            | The Play Fund's engagement-based payout model is structurally different from direct-sale; no explicit prohibition, but no sanction either.                                                                          |
| Eco, Terraria, Starbound       | Needs legal counsel / direct publisher contact | Genuinely no public policy found either direction on real-money mod/map sales. Re-Logic and Strange Loop Games both have modder-friendly reputations — direct outreach is plausible and cheap relative to guessing. |
| 7 Days to Die, Project Zomboid | Would be `EXCLUDED` if added                   | Explicit, specific bans on charging currency/items beyond donations (7DTD) and blanket no-mod-monetization (Zomboid, secondary-sourced — primary page returned 403 during research, flagged for re-verification).   |

## Adding a new game

1. Confirm its classification against this document (or commission new
   research if it's not covered above) — do not default a new game to
   `FULL` without a specific reason to.
2. Seed it via `prisma/seed.ts`'s `games` array with `contentPolicy` and
   a `policyNote` citing the source.
3. If reclassifying an existing game more restrictively, check for
   existing `Product` rows that would now violate the new policy —
   `staffApproveProduct`'s defense-in-depth check stops new approvals,
   but already-`APPROVED`/published listings are not retroactively
   unpublished by this system today (a manual admin sweep would be
   needed — not automated, deliberately not built speculatively).
