import { describe, expect, it } from "vitest";
import {
  INTEGRATION_CONCURRENCY,
  integrationWorkerHealth,
} from "@/features/servers/services/integration-worker.service";
import {
  mapWithConcurrency,
  operationalStateAfterFailure,
  POLL_CIRCUIT_FAILURES,
} from "@/features/servers/services/polling.service";

describe("integration worker bounds", () => {
  it("keeps concurrency bounded", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], INTEGRATION_CONCURRENCY, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(INTEGRATION_CONCURRENCY);
  });

  it("opens a degraded circuit after repeated failures", () => {
    expect(operationalStateAfterFailure(1)).toBe("UNKNOWN");
    expect(operationalStateAfterFailure(POLL_CIRCUIT_FAILURES)).toBe("DEGRADED");
  });

  it("reports encryption health without secrets", () => {
    const previous = process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY;
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const health = integrationWorkerHealth();
    expect(health.ok).toBe(true);
    expect(JSON.stringify(health)).not.toMatch(/password|ciphertext/i);
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY = previous;
  });
});
