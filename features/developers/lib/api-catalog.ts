/**
 * Source of truth for the KOBA API catalog page (developer.koba.games /
 * /developers/apis). Per ROADMAP.md Phase 9, originally: "KOBA APIs
 * exposed to developers: AI Behavior, Faction Simulation, Event Trigger,
 * Logistics, NPC Personality, Pack Metadata." NPC Personality removed
 * from scope for now (client, 2026-08-17) — 5 surfaces remain. Each is
 * effectively its own mini-product — treated as a separately versioned
 * API surface with its own docs/sandbox rather than one monolithic "dev
 * API."
 *
 * None of these have real backing endpoints yet — this is a
 * documentation/catalog page describing what's planned, not a live API
 * reference. `status: "planned"` everywhere reflects that honestly;
 * flip an entry to `"sandbox"` or `"live"` only once it actually has a
 * real endpoint behind it. Pricing is deliberately unset (client
 * decision, 2026-08-17: ship the catalog now, price later) — every
 * surface's `pricing` renders as "Coming soon" rather than an invented
 * number.
 */

export type ApiSurfaceStatus = "planned" | "sandbox" | "live";

export type ApiSurface = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** What a real integration would use this surface for — grounded,
   * game-specific examples, not generic marketing copy. */
  useCases: string[];
  /** Illustrative capability list — what the surface is scoped to do,
   * not a literal endpoint/method reference (none exist yet). */
  capabilities: string[];
  status: ApiSurfaceStatus;
};

export const API_CATALOG: ApiSurface[] = [
  {
    slug: "ai-behavior",
    name: "AI Behavior",
    tagline: "Scriptable NPC and creature decision-making.",
    description:
      "Drive non-player character and creature behavior trees — patrol patterns, aggro rules, " +
      "flee/fight thresholds, group coordination — from outside the game's own scripting layer, " +
      "so a plugin can reshape how enemies or companions act without hand-editing the game's AI.",
    useCases: [
      "A Rust plugin that makes scientist NPCs call for reinforcements when a raid is detected.",
      "A survival mod where wildlife behavior shifts with in-game weather or time of day.",
    ],
    capabilities: [
      "Read/write behavior-tree parameters for a supported game's NPC types",
      "Subscribe to behavior-state change events (aggro, flee, idle, alert)",
      "Register custom decision rules scoped to a specific server",
    ],
    status: "planned",
  },
  {
    slug: "faction-simulation",
    name: "Faction Simulation",
    tagline: "Persistent group standing, territory, and reputation.",
    description:
      "Model factions as first-class server state — standing between groups, territory control, " +
      "reputation with individual players — so plugins and Discord bots can read and react to the " +
      "same faction state instead of each maintaining their own copy.",
    useCases: [
      "A clan-war plugin that reads live territory control to gate base-raid eligibility.",
      "A Discord bot that posts an alert when a faction's reputation with a player crosses a threshold.",
    ],
    capabilities: [
      "Query current faction standings and territory ownership for a server",
      "Adjust reputation/standing values from a trusted integration",
      "Subscribe to faction-state change events",
    ],
    status: "planned",
  },
  {
    slug: "event-trigger",
    name: "Event Trigger",
    tagline: "Fire and listen for real in-game events.",
    description:
      "A shared event bus between a game server, KOBA, and third-party integrations — kills, " +
      "captures, purchases, boss spawns — so a plugin or bot doesn't need its own polling loop to " +
      "know something happened.",
    useCases: [
      "A Discord bot that posts a message the instant a server's boss monster spawns.",
      "A KOBA Reactive Skin (Phase 14/21) reacting to a kill-streak event mid-match.",
    ],
    capabilities: [
      "Publish a custom event from an integration for other subscribers to react to",
      "Subscribe to a scoped set of event types for a specific server",
      "Replay-safe delivery (idempotent event IDs) so retries never double-fire",
    ],
    status: "planned",
  },
  {
    slug: "logistics",
    name: "Logistics",
    tagline: "Item delivery, inventory sync, and fulfillment.",
    description:
      "The same delivery pipeline KOBA's own marketplace uses for RCON-based item delivery, " +
      "exposed so third-party integrations (a Discord bot's redeem command, a PC plugin's in-game " +
      "shop) can trigger a real, audited delivery instead of re-implementing RCON plumbing.",
    useCases: [
      "A Discord bot's `/redeem` slash command that delivers a purchased skin in-game.",
      "A plugin-side in-game shop that settles through KOBA Coins and delivers via this surface.",
    ],
    capabilities: [
      "Trigger an item delivery to a specific player on a specific server",
      "Query delivery status/history for a purchase",
      "Idempotent delivery requests (safe to retry without double-granting)",
    ],
    status: "planned",
  },
  {
    slug: "pack-metadata",
    name: "Pack Metadata",
    tagline: "Structured info about bundled asset packs.",
    description:
      "Read structured metadata for KOBA marketplace packs (bundle contents, compatible games, " +
      "version history) so a plugin or launcher can display accurate pack info without scraping " +
      "the storefront.",
    useCases: [
      "A PC plugin (Phase 21) showing what's inside a pack before a player applies it.",
      "A Discord bot's `/pack info` command pulling live bundle contents.",
    ],
    capabilities: [
      "Query a pack's bundled product/cosmetic list and compatible games",
      "Query version history for a pack",
      "Subscribe to pack-updated events",
    ],
    status: "planned",
  },
];

export function getApiSurface(slug: string): ApiSurface | undefined {
  return API_CATALOG.find((surface) => surface.slug === slug);
}
