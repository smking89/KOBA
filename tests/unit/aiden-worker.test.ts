import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/features/aiden/lib/concurrency";
import {
  AIDEN_WORKER_BATCH,
  AIDEN_WORKER_CONCURRENCY,
  aidenWorkerHealth,
} from "@/features/aiden/lib/worker-health";

describe("Aiden worker", () => {
  it("keeps concurrency and batch size bounded", async () => {
    expect(AIDEN_WORKER_CONCURRENCY).toBe(2);
    expect(AIDEN_WORKER_BATCH).toBe(8);
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], AIDEN_WORKER_CONCURRENCY, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(AIDEN_WORKER_CONCURRENCY);
  });

  it("reports health without secrets or an active malware scanner", () => {
    const health = aidenWorkerHealth();
    expect(health.ok).toBe(true);
    expect(health.queue).toBe("postgres");
    expect(health.malwareScanning).toBe(false);
    expect(health.realProviderConfigured).toBe(false);
    expect(JSON.stringify(health)).not.toMatch(/api[_-]?key|secret|password/i);
  });
});
