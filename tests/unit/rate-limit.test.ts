import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimitStore } from "@/lib/security/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const first = rateLimit("test-key", 2, 60_000);
    const second = rateLimit("test-key", 2, 60_000);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    rateLimit("blocked-key", 1, 60_000);
    const blocked = rateLimit("blocked-key", 1, 60_000);

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
