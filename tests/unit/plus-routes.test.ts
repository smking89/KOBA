import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getSubscriptionStatus, createPlusCheckout, rateLimit } = vi.hoisted(() => ({
  auth: vi.fn(),
  getSubscriptionStatus: vi.fn(),
  createPlusCheckout: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/http/client-ip", () => ({ clientIp: () => "127.0.0.1" }));
vi.mock("@/features/plus/services/plus.service", () => ({
  getSubscriptionStatus,
  createPlusCheckout,
  getPlanComparison: vi.fn(),
  createBillingPortal: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
  reactivateSubscription: vi.fn(),
}));

import { GET as getPlus } from "@/app/api/plus/route";
import { POST as postCheckout } from "@/app/api/plus/checkout/route";

describe("Plus API auth and headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue({ success: true });
  });

  it("rejects unauthenticated checkout and status reads", async () => {
    auth.mockResolvedValue(null);
    const status = await getPlus();
    expect(status.status).toBe(401);
    expect(status.headers.get("Cache-Control")).toBe("no-store");

    const checkout = await postCheckout(
      new Request("http://localhost/api/plus/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: "KOBA_PLUS_MONTHLY",
          idempotencyKey: "idem-12345678",
        }),
      }),
    );
    expect(checkout.status).toBe(401);
    expect(createPlusCheckout).not.toHaveBeenCalled();
  });

  it("does not accept a client Price ID even when signed in", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    const checkout = await postCheckout(
      new Request("http://localhost/api/plus/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: "KOBA_PLUS_MONTHLY",
          idempotencyKey: "idem-12345678",
          priceId: "price_from_browser",
        }),
      }),
    );
    expect(checkout.status).toBe(400);
    expect(createPlusCheckout).not.toHaveBeenCalled();
  });

  it("returns no-store on a successful status read", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    getSubscriptionStatus.mockResolvedValue({ state: "NONE", entitled: false });
    const response = await getPlus();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
