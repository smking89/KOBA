import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG, LADDER_THRESHOLDS } from "@/features/achievements/lib/catalog";
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
      if (entry.icon === "koba-plus") continue; // sentinel, not a lucide icon — see AchievementBadge
      expect(ICON_MAP[entry.icon], `catalog icon "${entry.icon}" (${entry.slug}) not in ICON_MAP`).toBeDefined();
    }
  });

  it("never shows a numeral alongside the koba-plus mark (it would compete for space)", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      if (entry.icon === "koba-plus") {
        expect(entry.numeral, `${entry.slug} is koba-plus but also sets numeral`).toBeUndefined();
      }
    }
  });

  // Client correction, 2026-08-17: Trade Veteran's `Repeat` icon read as
  // "the repost icon" (ProductActionRail uses the near-identical `Repeat2`)
  // — badges must never reuse an icon from navigation or any functional UI
  // control, even a visual lookalike. This list is every icon actually
  // wired into IconRail, AppSidebar, AppHeader, MobileNav,
  // ProductActionRail, and the homepage feature grid as of that fix —
  // update it if one of those surfaces changes its icon set.
  const RESERVED_NAV_AND_ACTION_ICONS = new Set([
    // IconRail / MobileNav
    "Home",
    "Store",
    "Server",
    "Users",
    "Newspaper",
    "MessageSquare",
    "Ellipsis",
    // AppSidebar / AppHeader
    "Hash",
    "Settings",
    "LogOut",
    "Menu",
    // ProductActionRail
    "Heart",
    "MessageCircle",
    "Bookmark",
    "Repeat2",
    "Repeat", // visual lookalike of Repeat2 — reserved too, not just an exact-name check
    "Share2",
    // Homepage feature grid
    "ShoppingBag",
    "Zap",
  ]);

  it("never reuses a navigation or action-rail icon (not even a lookalike)", () => {
    for (const entry of ACHIEVEMENT_CATALOG) {
      expect(
        RESERVED_NAV_AND_ACTION_ICONS.has(entry.icon),
        `catalog icon "${entry.icon}" (${entry.slug}) collides with a nav/action-rail icon`,
      ).toBe(false);
    }
  });

  it("gives every ladder-generated badge a numeral matching its rank (except the Plus mark)", () => {
    const ladderPrefixes = ["account-age-", "trade-", "collector-", "boost-rank-"];
    for (const prefix of ladderPrefixes) {
      const entries = ACHIEVEMENT_CATALOG.filter((entry) => entry.slug.startsWith(prefix));
      entries.forEach((entry, index) => {
        expect(entry.numeral, `${entry.slug} missing its ladder numeral`).toBe(index + 1);
      });
    }
  });

  it("has a monotonically increasing threshold within every ladder", () => {
    const prefixes = [
      "account-age-",
      "trade-",
      "collector-",
      "boost-rank-",
      "plus-",
    ];
    for (const prefix of prefixes) {
      const slugs = ACHIEVEMENT_CATALOG.filter((entry) => entry.slug.startsWith(prefix)).map(
        (entry) => entry.slug,
      );
      expect(slugs.length).toBeGreaterThan(1);
      const thresholds = slugs.map((slug) => LADDER_THRESHOLDS[slug]);
      for (let i = 1; i < thresholds.length; i++) {
        expect(
          thresholds[i]!,
          `${prefix} ladder threshold did not increase at index ${i}`,
        ).toBeGreaterThan(thresholds[i - 1]!);
      }
    }
  });
});
