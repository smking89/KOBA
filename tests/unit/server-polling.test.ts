import { describe, expect, it } from "vitest";
import {
  computeBackoffMs,
  mapWithConcurrency,
  operationalStateAfterFailure,
  POLL_CIRCUIT_FAILURES,
  withJitter,
} from "@/features/servers/services/polling.service";

describe("polling foundation", () => {
  it("does not mark permanent offline after one failure", () => {
    expect(operationalStateAfterFailure(1)).toBe("UNKNOWN");
    expect(operationalStateAfterFailure(2)).toBe("DEGRADED");
    expect(operationalStateAfterFailure(POLL_CIRCUIT_FAILURES)).toBe("DEGRADED");
  });

  it("applies exponential backoff with circuit cooldown", () => {
    expect(computeBackoffMs(0)).toBe(60_000);
    expect(computeBackoffMs(1)).toBe(120_000);
    expect(computeBackoffMs(POLL_CIRCUIT_FAILURES)).toBeGreaterThan(computeBackoffMs(3));
  });

  it("adds bounded jitter", () => {
    const base = 1000;
    const j = withJitter(base, 0.2, () => 0.5);
    expect(j).toBe(1000);
  });

  it("bounds concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
