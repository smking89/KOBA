import { describe, expect, it } from "vitest";
import { buildFreshness, metricState } from "@/features/servers/lib/freshness";

describe("freshness and metric states", () => {
  it("marks expired freshUntil as stale", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const meta = buildFreshness({
      checkedAt: new Date("2026-08-15T11:00:00.000Z"),
      lastSuccessfulAt: new Date("2026-08-15T11:00:00.000Z"),
      freshUntil: new Date("2026-08-15T11:01:30.000Z"),
      source: "minecraft-java",
      now,
    });
    expect(meta.isStale).toBe(true);
  });

  it("distinguishes unsupported, unavailable, stale, and available", () => {
    expect(metricState({ supported: false, valuePresent: true, isStale: false })).toBe(
      "NOT_SUPPORTED",
    );
    expect(
      metricState({
        supported: true,
        valuePresent: false,
        isStale: false,
        transientFailure: true,
      }),
    ).toBe("TEMPORARILY_UNAVAILABLE");
    expect(metricState({ supported: true, valuePresent: true, isStale: true })).toBe("STALE");
    expect(metricState({ supported: true, valuePresent: true, isStale: false })).toBe("AVAILABLE");
    expect(metricState({ supported: true, valuePresent: false, isStale: false })).toBe("UNKNOWN");
  });
});
