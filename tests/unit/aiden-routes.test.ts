import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auth,
  rateLimit,
  createJob,
  cancelJob,
  getJob,
  listJobs,
  estimateJobCost,
  getAidenWalletPreview,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  estimateJobCost: vi.fn(),
  getAidenWalletPreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/http/client-ip", () => ({ clientIp: () => "127.0.0.1" }));
vi.mock("@/features/aiden/services/aiden.service", () => ({
  createJob,
  cancelJob,
  getJob,
  listJobs,
  estimateJobCost,
  getAidenWalletPreview,
  listLibrary: vi.fn(),
  publishToShopRequest: vi.fn(),
  getAssetMedia: vi.fn(),
}));

import { POST as postEstimate } from "@/app/api/aiden/estimate/route";
import { GET as getJobs, POST as postJobs } from "@/app/api/aiden/jobs/route";
import { GET as getJobRoute, PATCH as patchJob } from "@/app/api/aiden/jobs/[ref]/route";

describe("Aiden API auth and cache headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue({ success: true });
  });

  it("rejects unauthenticated estimate, create, and reads with no-store", async () => {
    auth.mockResolvedValue(null);
    const estimate = await postEstimate(
      new Request("http://localhost/api/aiden/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "CONCEPT_IMAGE" }),
      }),
    );
    expect(estimate.status).toBe(401);
    expect(estimate.headers.get("Cache-Control")).toBe("no-store");

    const list = await getJobs();
    expect(list.status).toBe(401);
    expect(list.headers.get("Cache-Control")).toBe("no-store");

    const created = await postJobs(
      new Request("http://localhost/api/aiden/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "weathered crate concept",
          game: "Rust",
          platform: "STEAM",
          idempotencyKey: "idem-12345678",
        }),
      }),
    );
    expect(created.status).toBe(401);
    expect(createJob).not.toHaveBeenCalled();
  });

  it("rejects invalid create payloads", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    const response = await postJobs(
      new Request("http://localhost/api/aiden/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "x", game: "Rust" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(createJob).not.toHaveBeenCalled();
  });

  it("returns no-store on estimate and job reads", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    estimateJobCost.mockResolvedValue({ estimatedCostCoins: "40", active: true });
    getAidenWalletPreview.mockResolvedValue({ available: "100", reserved: "0", total: "100" });
    listJobs.mockResolvedValue([]);
    getJob.mockResolvedValue({ publicRef: "KOBA-ADN-JOBTEST01", state: "QUEUED" });

    const estimate = await postEstimate(
      new Request("http://localhost/api/aiden/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "CONCEPT_IMAGE" }),
      }),
    );
    expect(estimate.status).toBe(200);
    expect(estimate.headers.get("Cache-Control")).toBe("no-store");

    const list = await getJobs();
    expect(list.status).toBe(200);
    expect(list.headers.get("Cache-Control")).toBe("no-store");

    const job = await getJobRoute(new Request("http://localhost/api/aiden/jobs/x"), {
      params: Promise.resolve({ ref: "KOBA-ADN-JOBTEST01" }),
    });
    expect(job.status).toBe(200);
    expect(job.headers.get("Cache-Control")).toBe("no-store");
  });

  it("cancels only through the authenticated owner route", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    cancelJob.mockResolvedValue({ publicRef: "KOBA-ADN-JOBTEST01", state: "CANCELLED" });
    const response = await patchJob(
      new Request("http://localhost/api/aiden/jobs/KOBA-ADN-JOBTEST01", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", idempotencyKey: "cancel-12345678" }),
      }),
      { params: Promise.resolve({ ref: "KOBA-ADN-JOBTEST01" }) },
    );
    expect(response.status).toBe(200);
    expect(cancelJob).toHaveBeenCalledWith("user_1", "KOBA-ADN-JOBTEST01", "127.0.0.1");
  });
});
