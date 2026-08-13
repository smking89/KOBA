# KOBA

Infinite-scrolling social marketplace for game servers — trade skins, maps,
monuments, and cosmetics; follow shops and creators; find groups and squads;
all on one KOBAID.

## Status

**Phase 0 — UI / GUI / UX (design-first)** is complete. Everything else in
the build plan below comes after.

## Design system

[`design/ui-ux-design-system.html`](design/ui-ux-design-system.html) is a
single self-contained, navigable prototype covering:

- **Design language** — color, type, spacing, motion, iconography, accessibility rules
- **Component library** — buttons, cards, modals, tabs, nameplates, avatar frames, cosmetics
- **Every core screen** — registration, KOBAID reveal, Player/Business/Influencer
  dashboards, marketplace (TCG-style trading cards), auctions, shops, groups,
  LFG, Instagram-style social feed, stories, DMs (calls, stickers, voice
  messages, vanish mode), tagging, promo pages, developer portal, Stripe
  connection, settings, and role-based admin

Open the file in a browser — the left rail switches between screens, and the
Desktop/Mobile toggle reflows each one live.

## KOBAID

Every account is a `KOBA-XX-XXXX` code, role-coded and short enough to read
out loud:

| Format | Role |
|---|---|
| `KOBA-PL` | Player |
| `KOBA-BZ` | Business |
| `KOBA-IN` | Influencer |
| `KOBA-SA` | Superadmin (staff, no badge) |
| `KOBA-AD` | Admin (staff, no badge) |
| `KOBA-MD` | Moderator (staff, no badge) |

One KOBAID per role, per device. Community "Admin"/"Moderator" badges in
Groups and Shops are a separate thing — a role tag on a normal Player or
Business KOBAID, not a staff account.

## Supported games

**PC (full support — dedicated servers, modding, item spawning, RCON):**
Rust, Minecraft Java, ARK: Survival Ascended, ARK: Survival Evolved, DayZ,
7 Days to Die, Conan Exiles, Valheim, Unturned, Garry's Mod, S&Box, Project
Zomboid, Eco, Terraria, Starbound.

**Console (kits & cosmetics only — no custom assets or modding):**
Rust Console Edition, ARK: Survival Evolved/Ascended (Console), Conan Exiles
(Console), 7 Days to Die (Console), Minecraft Bedrock.

## Build plan

1. ~~UI / GUI / UX design~~ ✅
2. KOBAID + account types (Player / Business / Influencer capability flags)
3. Account switching flow
4. Marketplace core (products, cosmetics, auctions, bids, orders, rarity, Stripe)
5. Shops + business tools
6. Groups + LFG system
7. Social layer (tagging included)
8. KOBA Ads (native ads / KCU)
9. Feed engine (organic + ads ranking)
10. Developer portal (Map Builder, KOBA APIs, sandbox, publishing, earnings)
11. Influencer system + promo page
12. Role system (Superadmin, Admin, Moderator — RBAC)
13. Database schema (full integration)
14. API routes

## License

All rights reserved — see [LICENSE](LICENSE).
