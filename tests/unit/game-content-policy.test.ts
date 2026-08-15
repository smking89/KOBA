import { describe, expect, it } from "vitest";
import {
  gamePolicyDenialReason,
  isListingAllowedForGame,
} from "@/features/marketplace/lib/game-policy";

describe("game content policy", () => {
  it("FULL allows every category kind", () => {
    expect(isListingAllowedForGame("FULL", "MAPS")).toBe(true);
    expect(isListingAllowedForGame("FULL", "COSMETICS")).toBe(true);
    expect(isListingAllowedForGame("FULL", "SKINS")).toBe(true);
  });

  it("SKINS_ONLY allows only the SKINS category kind (in-game skins, not COSMETICS)", () => {
    expect(isListingAllowedForGame("SKINS_ONLY", "SKINS")).toBe(true);
    expect(isListingAllowedForGame("SKINS_ONLY", "COSMETICS")).toBe(false);
    expect(isListingAllowedForGame("SKINS_ONLY", "MAPS")).toBe(false);
    expect(isListingAllowedForGame("SKINS_ONLY", "KITS")).toBe(false);
    expect(isListingAllowedForGame("SKINS_ONLY", "SERVER_ASSETS")).toBe(false);
  });

  it("EXCLUDED and LEGAL_REVIEW allow nothing, regardless of category", () => {
    for (const kind of [
      "MAPS",
      "COSMETICS",
      "SKINS",
      "KITS",
      "SERVER_ASSETS",
      "MONUMENTS",
    ] as const) {
      expect(isListingAllowedForGame("EXCLUDED", kind)).toBe(false);
      expect(isListingAllowedForGame("LEGAL_REVIEW", kind)).toBe(false);
    }
  });

  it("denial reasons name the game and include the policy note when present", () => {
    expect(gamePolicyDenialReason("EXCLUDED", "ARK: Survival Ascended", "Wildcard rule")).toBe(
      "ARK: Survival Ascended is excluded from the marketplace pending legal/publisher resolution. (Wildcard rule)",
    );
    expect(gamePolicyDenialReason("SKINS_ONLY", "Minecraft", null)).toBe(
      "Minecraft only allows in-game skin listings — mods, maps, and kits are not permitted pending legal review.",
    );
    expect(gamePolicyDenialReason("LEGAL_REVIEW", "S&Box", null)).toBe(
      "S&Box requires legal counsel confirmation before any listings are allowed.",
    );
  });
});
