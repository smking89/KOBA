import type { GameContentPolicy, ProductCategoryKind } from "@/lib/generated/prisma/client";

/**
 * Per-game marketplace-content gate, from the ARK deep-dive + per-title
 * ToS sweep (2026-08-14, docs/game-content-policy.md). Desk research, not
 * legal counsel — a game marked FULL or SKINS_ONLY here is not a legal
 * clearance, it's this repo's current best understanding, to be confirmed
 * by actual counsel before launch.
 *
 * SKINS_ONLY gates on Category.kind === "SKINS" (in-game character/item
 * skins — a Minecraft cape, a DayZ clothing item — the actual thing these
 * publishers' "cosmetics/perks are the sanctioned path" policies describe).
 * It deliberately does NOT gate Category.kind === "COSMETICS" — that
 * category and the separate Cosmetic model (avatar decorations, profile
 * effects, nameplates, profile frames, shop banners, emojis — KOBA's own
 * subscription-style profile/shop customization) are never game-specific
 * and are never subject to any single game's ToS, so they're never gated
 * by this function at all — no game policy can restrict them.
 */
export function isListingAllowedForGame(
  contentPolicy: GameContentPolicy,
  categoryKind: ProductCategoryKind,
): boolean {
  switch (contentPolicy) {
    case "FULL":
      return true;
    case "SKINS_ONLY":
      return categoryKind === "SKINS";
    case "EXCLUDED":
    case "LEGAL_REVIEW":
      return false;
    default:
      return false;
  }
}

export function gamePolicyDenialReason(
  contentPolicy: GameContentPolicy,
  gameName: string,
  policyNote?: string | null,
): string {
  const suffix = policyNote ? ` (${policyNote})` : "";
  switch (contentPolicy) {
    case "EXCLUDED":
      return `${gameName} is excluded from the marketplace pending legal/publisher resolution.${suffix}`;
    case "LEGAL_REVIEW":
      return `${gameName} requires legal counsel confirmation before any listings are allowed.${suffix}`;
    case "SKINS_ONLY":
      return `${gameName} only allows in-game skin listings — mods, maps, and kits are not permitted pending legal review.${suffix}`;
    default:
      return `${gameName} does not allow this listing.${suffix}`;
  }
}
