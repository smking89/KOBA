import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletError } from "@/features/wallet/lib/errors";
import { AidenError } from "@/features/aiden/lib/errors";
import type { AidenGenerationProvider, AidenProviderResult } from "@/features/aiden/lib/provider";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const { prisma, reserveCoins, releaseReservation, settleReservation, signAidenObjectUrl } =
  vi.hoisted(() => {
    const jobs = new Map<string, Record<string, unknown>>();
    const assets = new Map<string, Record<string, unknown>>();

    function apply(row: Record<string, unknown>, data: Record<string, unknown>) {
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object" && "increment" in value) {
          row[key] = Number(row[key] ?? 0) + Number((value as { increment: number }).increment);
        } else {
          row[key] = value;
        }
      }
    }

    const prisma = {
      _jobs: jobs,
      _assets: assets,
      aidenJob: {
        findUnique: vi.fn(
          async ({ where, include }: { where: Record<string, string>; include?: unknown }) => {
            const row = where.publicRef
              ? jobs.get(where.publicRef)
              : [...jobs.values()].find((job) => job.idempotencyKey === where.idempotencyKey);
            if (!row) return null;
            const asset = [...assets.values()].find((item) => item.jobId === row.id) ?? null;
            return include ? { ...row, asset } : { ...row };
          },
        ),
        findFirst: vi.fn(
          async ({ where }: { where: { providerRequestId?: string; NOT?: { id: string } } }) => {
            return (
              [...jobs.values()].find(
                (job) =>
                  job.providerRequestId === where.providerRequestId && job.id !== where.NOT?.id,
              ) ?? null
            );
          },
        ),
        findMany: vi.fn(async () => {
          const now = Date.now();
          return [...jobs.values()].filter((job) => {
            if (job.state === "QUEUED") return true;
            if (job.state === "PROCESSING") {
              const claimed = job.claimedAt instanceof Date ? job.claimedAt.getTime() : 0;
              return claimed > 0 && now - claimed > 2 * 60 * 1000;
            }
            return false;
          });
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if ([...jobs.values()].some((job) => job.idempotencyKey === data.idempotencyKey)) {
            const error = Object.assign(new Error("Unique"), { code: "P2002" });
            throw error;
          }
          const row = {
            id: `id_${jobs.size + 1}`,
            asset: null,
            version: 0,
            createdAt: new Date("2026-08-15T00:00:00.000Z"),
            ...data,
          };
          jobs.set(String(data.publicRef), row);
          return row;
        }),
        update: vi.fn(
          async ({
            where,
            data,
            include,
          }: {
            where: { id?: string; publicRef?: string };
            data: Record<string, unknown>;
            include?: unknown;
          }) => {
            const row =
              [...jobs.values()].find((job) => job.id === where.id) ??
              (where.publicRef ? jobs.get(where.publicRef) : undefined);
            if (!row) throw new Error("missing job");
            apply(row, data);
            const asset = [...assets.values()].find((item) => item.jobId === row.id) ?? null;
            return include ? { ...row, asset } : { ...row };
          },
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            const row = [...jobs.values()].find((job) => job.id === where.id);
            if (!row) return { count: 0 };
            if (where.version != null && row.version !== where.version) return { count: 0 };
            const allowed = (where.state as { in?: string[] } | undefined)?.in;
            if (allowed && !allowed.includes(String(row.state))) return { count: 0 };
            apply(row, data);
            return { count: 1 };
          },
        ),
      },
      aidenAsset: {
        findUnique: vi.fn(
          async ({
            where,
            include,
          }: {
            where: { publicRef?: string; jobId?: string };
            include?: { job?: boolean };
          }) => {
            const row =
              (where.publicRef
                ? [...assets.values()].find((item) => item.publicRef === where.publicRef)
                : [...assets.values()].find((item) => item.jobId === where.jobId)) ?? null;
            if (!row) return null;
            const job = include?.job
              ? ([...jobs.values()].find((item) => item.id === row.jobId) ?? null)
              : undefined;
            return { ...row, job };
          },
        ),
        findMany: vi.fn(async ({ where }: { where?: { userId?: string } }) => {
          return [...assets.values()].filter(
            (item) => !where?.userId || item.userId === where.userId,
          );
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `asset_${assets.size + 1}`, ...data };
          assets.set(String(data.publicRef), row);
          return row;
        }),
        upsert: vi.fn(
          async ({
            where,
            create,
          }: {
            where: { jobId: string };
            create: Record<string, unknown>;
          }) => {
            const existing = [...assets.values()].find((item) => item.jobId === where.jobId);
            if (existing) return existing;
            const row = { id: `asset_${assets.size + 1}`, ...create };
            assets.set(String(create.publicRef), row);
            return row;
          },
        ),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const row = [...assets.values()].find((item) => item.id === where.id);
            if (!row) throw new Error("missing asset");
            apply(row, data);
            return { ...row };
          },
        ),
      },
    };

    return {
      prisma,
      reserveCoins: vi.fn(),
      releaseReservation: vi.fn(),
      settleReservation: vi.fn(),
      signAidenObjectUrl: vi.fn(async () => "https://signed.example/aiden?sig=1"),
    };
  });

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/features/auth/services/audit-log.service", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/features/aiden/lib/identity", () => ({
  resolveActiveAidenIdentity: vi.fn(async (userId: string) => ({
    userId,
    identityId: "ident_1",
    accountType: "PLAYER",
    code: "KOBA-PLTEST",
  })),
}));
vi.mock("@/features/wallet/services/ledger.service", () => ({
  reserveCoins,
  releaseReservation,
  settleReservation,
  getWalletSummary: vi.fn(async () => ({ available: "100", reserved: "0", total: "100" })),
}));
vi.mock("@/features/aiden/lib/storage", () => ({
  storeAidenObject: vi.fn(async ({ publicRef }: { publicRef: string }) => ({
    key: `aiden/user_1/${publicRef}.png`,
    stored: "inline",
  })),
  signAidenObjectUrl,
}));

import {
  cancelJob,
  claimQueuedJobs,
  completeFromProvider,
  createJob,
  getAssetMedia,
  getJob,
  processClaimedJob,
  publishToShopRequest,
} from "@/features/aiden/services/aiden.service";

function seedJob(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "job_1",
    publicRef: "KOBA-ADN-JOBTEST01",
    userId: "user_1",
    kobaIdentityId: "ident_1",
    prompt: "weathered metal crate concept",
    promptHash: "hash",
    game: "Rust",
    platform: "STEAM",
    assetType: "CONCEPT_IMAGE",
    settingsJson: JSON.stringify({ width: 512, height: 512, quality: "standard", count: 1 }),
    state: "QUEUED",
    coinCostPreview: 40,
    estimatedCostCoins: 40n,
    actualCostCoins: null,
    reservationPublicRef: "KOBA-RSV-1",
    reservationTxId: "KOBA-RSV-1",
    provider: "mock",
    model: "aiden-mock-concept",
    modelVersion: "1",
    providerRequestId: null,
    idempotencyKey: "idem-12345678",
    promptModeration: "ALLOWED",
    outputModeration: "PENDING",
    failureReason: null,
    failureClass: null,
    attempts: 0,
    maxAttempts: 3,
    runAfter: new Date(0),
    claimedAt: null,
    claimedBy: null,
    version: 0,
    cancelRequestedAt: null,
    createdAt: new Date("2026-08-15T00:00:00.000Z"),
    outputBytes: null,
    ...overrides,
  };
  prisma._jobs.set(String(row.publicRef), row);
  return row;
}

function providerResult(overrides: Partial<AidenProviderResult> = {}): AidenProviderResult {
  return {
    providerRequestId: "mock_abc",
    status: "succeeded",
    mime: "image/png",
    bytes: PNG_1X1,
    width: 1,
    height: 1,
    usage: { units: 1n, costCoins: 40n },
    model: "aiden-mock-concept",
    modelVersion: "1",
    ...overrides,
  };
}

describe("Aiden job service", () => {
  beforeEach(() => {
    prisma._jobs.clear();
    prisma._assets.clear();
    vi.clearAllMocks();
    reserveCoins.mockResolvedValue({ publicRef: "KOBA-RSV-1" });
    releaseReservation.mockResolvedValue({ publicRef: "KOBA-RSV-1", status: "RELEASED" });
    settleReservation.mockResolvedValue({
      publicRef: "KOBA-RSV-1",
      status: "CAPTURED",
      captured: "40",
      released: "0",
    });
  });

  it("reserves coins and queues a concept job", async () => {
    const job = await createJob("user_1", {
      prompt: "weathered metal crate concept",
      game: "Rust",
      platform: "STEAM",
      assetType: "CONCEPT_IMAGE",
      idempotencyKey: "idem-12345678",
    });
    expect(reserveCoins).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 40n, idempotencyKey: "aiden-job-reserve:idem-12345678" }),
    );
    expect(job.state).toBe("QUEUED");
    expect(job.estimatedCostCoins).toBe("40");
  });

  it("returns the existing job for a duplicate idempotency key", async () => {
    seedJob();
    const job = await createJob("user_1", {
      prompt: "weathered metal crate concept",
      game: "Rust",
      platform: "STEAM",
      assetType: "CONCEPT_IMAGE",
      idempotencyKey: "idem-12345678",
    });
    expect(reserveCoins).not.toHaveBeenCalled();
    expect(job.publicRef).toBe("KOBA-ADN-JOBTEST01");
  });

  it("rejects another account reusing an idempotency key", async () => {
    seedJob();
    await expect(
      createJob("user_2", {
        prompt: "weathered metal crate concept",
        game: "Rust",
        platform: "STEAM",
        assetType: "CONCEPT_IMAGE",
        idempotencyKey: "idem-12345678",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("maps insufficient coins to an Aiden error", async () => {
    reserveCoins.mockRejectedValueOnce(new WalletError("Need more coins.", "INSUFFICIENT"));
    await expect(
      createJob("user_1", {
        prompt: "weathered metal crate concept",
        game: "Rust",
        platform: "STEAM",
        assetType: "CONCEPT_IMAGE",
        idempotencyKey: "idem-abcdefg1",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT" });
  });

  it("blocks moderated prompts before reserving coins", async () => {
    await expect(
      createJob("user_1", {
        prompt: "credit card number please",
        game: "Rust",
        platform: "STEAM",
        assetType: "CONCEPT_IMAGE",
        idempotencyKey: "idem-abcdefg2",
      }),
    ).rejects.toBeInstanceOf(AidenError);
    expect(reserveCoins).not.toHaveBeenCalled();
  });

  it("isolates jobs by owning account", async () => {
    seedJob();
    await expect(getJob("user_2", "KOBA-ADN-JOBTEST01")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects unauthorized cancellation", async () => {
    seedJob();
    await expect(cancelJob("user_2", "KOBA-ADN-JOBTEST01")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it("cancels a queued job and releases the reservation", async () => {
    seedJob();
    const job = await cancelJob("user_1", "KOBA-ADN-JOBTEST01");
    expect(job.state).toBe("CANCELLED");
    expect(releaseReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationPublicRef: "KOBA-RSV-1",
        idempotencyKey: "aiden-cancelled-release:KOBA-ADN-JOBTEST01",
      }),
    );
  });

  it("claims a queued job once under concurrent workers", async () => {
    seedJob();
    const first = await claimQueuedJobs({ workerId: "w1" });
    const second = await claimQueuedJobs({ workerId: "w2" });
    expect(first).toEqual(["KOBA-ADN-JOBTEST01"]);
    expect(second).toEqual([]);
  });

  it("captures the actual cost when it matches the estimate", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    await completeFromProvider("KOBA-ADN-JOBTEST01", providerResult());
    expect(settleReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        captureAmount: 40n,
        idempotencyKey: "aiden-settle:KOBA-ADN-JOBTEST01",
      }),
    );
    expect(releaseReservation).not.toHaveBeenCalled();
    const job = await getJob("user_1", "KOBA-ADN-JOBTEST01");
    expect(job.state).toBe("SUCCEEDED");
  });

  it("releases unused reserved coins when actual cost is lower", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    await completeFromProvider(
      "KOBA-ADN-JOBTEST01",
      providerResult({ usage: { units: 1n, costCoins: 20n } }),
    );
    expect(settleReservation).toHaveBeenCalledWith(expect.objectContaining({ captureAmount: 20n }));
  });

  it("rejects an unexpected cost overrun and releases the reservation", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    const job = await completeFromProvider(
      "KOBA-ADN-JOBTEST01",
      providerResult({ usage: { units: 1n, costCoins: 99n } }),
    );
    expect(job.state).toBe("FAILED");
    expect(settleReservation).not.toHaveBeenCalled();
    expect(releaseReservation).toHaveBeenCalled();
  });

  it("releases the reservation when the provider fails", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    const failing: AidenGenerationProvider = {
      id: "mock",
      submit: async () => ({ providerRequestId: "mock_fail" }),
      retrieve: async () => {
        throw new Error("provider down");
      },
    };
    const result = await processClaimedJob("KOBA-ADN-JOBTEST01", { provider: failing });
    expect(result.state).toBe("QUEUED");
    seedJob({
      state: "PROCESSING",
      attempts: 3,
      maxAttempts: 3,
      version: 2,
    });
    const terminal = await processClaimedJob("KOBA-ADN-JOBTEST01", { provider: failing });
    expect(terminal.state).toBe("FAILED");
    expect(releaseReservation).toHaveBeenCalled();
  });

  it("ignores a duplicate completion instead of charging twice", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    await completeFromProvider("KOBA-ADN-JOBTEST01", providerResult());
    await completeFromProvider("KOBA-ADN-JOBTEST01", providerResult());
    expect(settleReservation).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe remote output URLs", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    const job = await completeFromProvider("KOBA-ADN-JOBTEST01", {
      providerRequestId: "mock_abc",
      status: "succeeded",
      remoteUrl: "http://127.0.0.1/secret.png",
      usage: { units: 1n, costCoins: 40n },
      model: "aiden-mock-concept",
      modelVersion: "1",
    });
    expect(job.state).toBe("FAILED");
    expect(job.failureReason).toMatch(/URL was rejected/i);
    expect(releaseReservation).toHaveBeenCalled();
  });

  it("rejects non-image bytes and oversized payloads", async () => {
    seedJob({ state: "PROCESSING", attempts: 1, version: 1 });
    const mime = await completeFromProvider(
      "KOBA-ADN-JOBTEST01",
      providerResult({ bytes: Buffer.from("not-an-image") }),
    );
    expect(mime.state).toBe("FAILED");
    seedJob({
      id: "job_size",
      publicRef: "KOBA-ADN-JOBSIZE",
      state: "PROCESSING",
      attempts: 1,
      version: 1,
    });
    const huge = Buffer.concat([PNG_1X1, Buffer.alloc(8 * 1024 * 1024)]);
    const size = await completeFromProvider("KOBA-ADN-JOBSIZE", providerResult({ bytes: huge }));
    expect(size.state).toBe("FAILED");
  });

  it("serves private media only to the owner", async () => {
    seedJob({ state: "SUCCEEDED", outputBytes: PNG_1X1 });
    prisma._assets.set("KOBA-ADN-ASTTEST01", {
      id: "asset_1",
      publicRef: "KOBA-ADN-ASTTEST01",
      userId: "user_1",
      jobId: "job_1",
      title: "Rust concept",
      assetType: "CONCEPT_IMAGE",
      technicalStatus: "CONCEPT_ONLY",
      moderation: "PRIVATE",
      game: "Rust",
      previewLabel: "Concept still",
      storageKey: "aiden/user_1/job.png",
      mimeType: "image/png",
      provider: "mock",
      model: "aiden-mock-concept",
      createdAt: new Date(),
    });
    const media = await getAssetMedia("user_1", "KOBA-ADN-ASTTEST01");
    expect(media.mode).toBe("bytes");
    await expect(getAssetMedia("user_2", "KOBA-ADN-ASTTEST01")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(signAidenObjectUrl).not.toHaveBeenCalled();
  });

  it("authorizes signed-URL redirects for the owner only", async () => {
    seedJob({ state: "SUCCEEDED", outputBytes: null });
    prisma._assets.set("KOBA-ADN-ASTSIGN", {
      id: "asset_sign",
      publicRef: "KOBA-ADN-ASTSIGN",
      userId: "user_1",
      jobId: "job_1",
      title: "Rust concept",
      assetType: "CONCEPT_IMAGE",
      technicalStatus: "CONCEPT_ONLY",
      moderation: "PRIVATE",
      game: "Rust",
      previewLabel: "Concept still",
      storageKey: "aiden/user_1/job.png",
      mimeType: "image/png",
      provider: "mock",
      model: "aiden-mock-concept",
      createdAt: new Date(),
    });
    const media = await getAssetMedia("user_1", "KOBA-ADN-ASTSIGN");
    expect(media).toMatchObject({ mode: "redirect", url: "https://signed.example/aiden?sig=1" });
    await expect(getAssetMedia("user_2", "KOBA-ADN-ASTSIGN")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("submits a private asset for marketplace review without listing it", async () => {
    prisma._assets.set("KOBA-ADN-ASTTEST01", {
      id: "asset_1",
      publicRef: "KOBA-ADN-ASTTEST01",
      userId: "user_1",
      jobId: "job_1",
      title: "Rust concept",
      assetType: "CONCEPT_IMAGE",
      technicalStatus: "CONCEPT_ONLY",
      moderation: "PRIVATE",
      game: "Rust",
      previewLabel: "Concept still",
      provider: "mock",
      model: "aiden-mock-concept",
      modelVersion: "1",
      createdAt: new Date(),
    });
    const asset = await publishToShopRequest("user_1", "KOBA-ADN-ASTTEST01");
    expect(asset.moderation).toBe("PENDING_REVIEW");
    const again = await publishToShopRequest("user_1", "KOBA-ADN-ASTTEST01");
    expect(again.moderation).toBe("PENDING_REVIEW");
  });

  it("runs the mock provider through claim and completion", async () => {
    seedJob();
    await claimQueuedJobs({ workerId: "aiden-worker" });
    const result = await processClaimedJob("KOBA-ADN-JOBTEST01");
    expect(result.state).toBe("SUCCEEDED");
    expect(settleReservation).toHaveBeenCalledTimes(1);
  });
});
