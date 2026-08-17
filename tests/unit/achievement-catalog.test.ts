import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG } from "@/features/achievements/lib/catalog";
import { ICON_MAP } from "@/features/achievements/components/achievement-badge";

const RARITIES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "RELIC"];
const CATEGORIES = ["ACCOUNT_AGE", "TRADING", "MARKETPLACE", "COMMUNITY", "SPECIAL"];

describe("ACHIEVEMENT_CATALOG", () => {
  it("has unique slugs", () => {
    const slugs = ACHIEVEMENT_CATALOG.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses only the six marketplace rarity tiers", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      expect(RARITIES).toContain(entry.rarity);
    }
  });

  it("uses only defined achievement categories", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      expect(CATEGORIES).toContain(entry.category);
    }
  });

  it("gives every entry a non-empty name, description, and icon", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });

  it("has a registered lucide icon for every catalog entry (no silent Award fallback)", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      expect(ICON_MAP[entry.icon], `catalog icon "${entry.icon}" (${entry.slug}) not in ICON_MAP`).toBeDefined();
    }
  });
});
