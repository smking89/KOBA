import { describe, expect, it } from "vitest";
import { tenureBadgeLabel, tenureBadgeTier } from "@/features/plus/lib/tenure";

describe("tenureBadgeTier", () => {
  it("is BRONZE on day one", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    expect(tenureBadgeTier(start, start)).toBe("BRONZE");
  });

  it("stays BRONZE just under 3 months", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const now = new Date("2026-04-14T00:00:00.000Z");
    expect(tenureBadgeTier(start, now)).toBe("BRONZE");
  });

  it("reaches SILVER at exactly 3 months", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const now = new Date("2026-04-15T00:00:00.000Z");
    expect(tenureBadgeTier(start, now)).toBe("SILVER");
  });

  it("reaches GOLD at exactly 6 months", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const now = new Date("2026-07-15T00:00:00.000Z");
    expect(tenureBadgeTier(start, now)).toBe("GOLD");
  });

  it("reaches DIAMOND at exactly 12 months and stays there beyond", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    expect(tenureBadgeTier(start, new Date("2027-01-15T00:00:00.000Z"))).toBe("DIAMOND");
    expect(tenureBadgeTier(start, new Date("2029-06-01T00:00:00.000Z"))).toBe("DIAMOND");
  });

  it("never returns a tier below BRONZE for a future firstActivatedAt (clamped, not negative)", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(tenureBadgeTier(start, now)).toBe("BRONZE");
  });
});

describe("tenureBadgeLabel", () => {
  it("labels every tier distinctly and includes 'Plus Member'", () => {
    for (const tier of ["BRONZE", "SILVER", "GOLD", "DIAMOND"] as const) {
      expect(tenureBadgeLabel(tier)).toContain("Plus Member");
    }
    const labels = new Set(
      (["BRONZE", "SILVER", "GOLD", "DIAMOND"] as const).map((t) => tenureBadgeLabel(t)),
    );
    expect(labels.size).toBe(4);
  });
});
