import { afterEach, describe, expect, it } from "vitest";
import { estimateAidenCost, isAidenGenerationTypeActive } from "@/features/aiden/lib/pricing";
import { canTransitionAidenJob } from "@/features/aiden/lib/state-machine";
import { moderateAidenPrompt } from "@/features/aiden/lib/moderation";
import {
  AIDEN_MAX_OUTPUT_BYTES,
  readPngSize,
  safeAidenFilename,
  sniffImageMime,
  validateImageLimits,
} from "@/features/aiden/lib/output-validation";
import { assertSafeProviderUrl } from "@/features/aiden/lib/safe-fetch";
import { malwareScanningActive } from "@/features/aiden/lib/malware-scan";
import {
  MockAidenProvider,
  RealAidenProvider,
  getAidenProvider,
  isRealAidenProviderConfigured,
  verifyAidenProviderCallback,
} from "@/features/aiden/lib/provider";
import { isObjectStorageConfigured } from "@/features/media/lib/storage";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("Aiden cost estimation", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.AIDEN_PRICE_CONCEPT_IMAGE = previous.AIDEN_PRICE_CONCEPT_IMAGE;
    process.env.AIDEN_PRICE_CONCEPT_IMAGE_HD_SURCHARGE =
      previous.AIDEN_PRICE_CONCEPT_IMAGE_HD_SURCHARGE;
    process.env.AIDEN_PRICE_LARGE_SURCHARGE = previous.AIDEN_PRICE_LARGE_SURCHARGE;
  });

  it("prices concept images from configuration, not UI constants", () => {
    process.env.AIDEN_PRICE_CONCEPT_IMAGE = "40";
    const estimate = estimateAidenCost({ assetType: "CONCEPT_IMAGE" });
    expect(estimate.estimatedCostCoins).toBe(40n);
    expect(estimate.estimatedCostCoinsText).toBe("40");
    expect(estimate.currency).toBe("KOBA_COIN");
    expect(estimate.active).toBe(true);
  });

  it("adds HD and large-dimension surcharges", () => {
    process.env.AIDEN_PRICE_CONCEPT_IMAGE = "40";
    process.env.AIDEN_PRICE_CONCEPT_IMAGE_HD_SURCHARGE = "20";
    process.env.AIDEN_PRICE_LARGE_SURCHARGE = "15";
    const hd = estimateAidenCost({ assetType: "CONCEPT_IMAGE", quality: "hd" });
    expect(hd.estimatedCostCoins).toBe(60n);
    const large = estimateAidenCost({
      assetType: "CONCEPT_IMAGE",
      width: 2048,
      height: 1024,
    });
    expect(large.estimatedCostCoins).toBe(55n);
  });

  // Client, 2026-08-18: SKIN generation (Tripo mesh+rig+diffuse,
  // Kandinsky PBR maps, Blender assembly — features/aiden/lib/
  // provider.ts#RealAidenProvider) went live end to end, so it moved
  // from AIDEN_ACTIVE_GENERATION_TYPES's inactive set into the active
  // one. TERRA's asset types (TERRAIN/MAP) have no real provider at
  // all yet (features/aiden/providers/terra-provider.ts is still a
  // stub) and stay inactive, same as the still-unwired Graft types.
  it("SKIN is active; TERRA/unwired Graft types stay inactive", () => {
    expect(isAidenGenerationTypeActive("CONCEPT_IMAGE")).toBe(true);
    expect(isAidenGenerationTypeActive("SKIN")).toBe(true);
    expect(estimateAidenCost({ assetType: "SKIN" }).active).toBe(true);

    for (const inactive of ["TEXTURE", "PROP", "ANIMATION", "TERRAIN", "MAP"] as const) {
      expect(isAidenGenerationTypeActive(inactive)).toBe(false);
      expect(estimateAidenCost({ assetType: inactive }).active).toBe(false);
    }
  });
});

describe("Aiden job state machine", () => {
  it("allows the async happy path and rejects invalid jumps", () => {
    expect(canTransitionAidenJob("QUEUED", "PROCESSING")).toBe(true);
    expect(canTransitionAidenJob("PROCESSING", "MODERATING")).toBe(true);
    expect(canTransitionAidenJob("MODERATING", "SUCCEEDED")).toBe(true);
    expect(canTransitionAidenJob("QUEUED", "CANCELLED")).toBe(true);
    expect(canTransitionAidenJob("QUEUED", "FAILED")).toBe(true);
    expect(canTransitionAidenJob("SUCCEEDED", "QUEUED")).toBe(false);
    expect(canTransitionAidenJob("CANCELLED", "QUEUED")).toBe(false);
    expect(canTransitionAidenJob("DRAFT", "SUCCEEDED")).toBe(false);
    expect(canTransitionAidenJob("COMPLETED", "FAILED")).toBe(false);
  });
});

describe("Aiden prompt moderation", () => {
  it("rejects short, long, and blocked prompts", () => {
    expect(moderateAidenPrompt("hi").status).toBe("BLOCKED");
    expect(moderateAidenPrompt("a".repeat(2001)).status).toBe("BLOCKED");
    expect(moderateAidenPrompt("weathered metal crate concept").status).toBe("ALLOWED");
    expect(moderateAidenPrompt("credit card number dump").status).toBe("BLOCKED");
  });
});

describe("Aiden output validation", () => {
  it("sniffs PNG bytes and rejects unsupported types and sizes", () => {
    expect(sniffImageMime(PNG_1X1)).toBe("image/png");
    expect(readPngSize(PNG_1X1)).toEqual({ width: 1, height: 1 });
    expect(validateImageLimits({ mime: "image/png", byteSize: 32, width: 1, height: 1 })).toEqual({
      ok: true,
    });
    expect(validateImageLimits({ mime: "application/octet-stream", byteSize: 32 }).ok).toBe(false);
    expect(
      validateImageLimits({ mime: "image/png", byteSize: AIDEN_MAX_OUTPUT_BYTES + 1 }).ok,
    ).toBe(false);
    expect(safeAidenFilename("KOBA-ADN-JOB../evil", "image/png")).toBe("koba-adn-job-evil.png");
  });
});

describe("Aiden SSRF and callbacks", () => {
  it("rejects unsafe provider URLs before download", async () => {
    await expect(assertSafeProviderUrl("http://127.0.0.1/x.png")).rejects.toMatchObject({
      name: "SsrfError",
    });
    await expect(assertSafeProviderUrl("https://127.0.0.1/x.png")).rejects.toMatchObject({
      name: "SsrfError",
    });
    await expect(assertSafeProviderUrl("https://169.254.169.254/latest")).rejects.toMatchObject({
      name: "SsrfError",
    });
  });

  it("does not accept provider callbacks in this phase", () => {
    expect(verifyAidenProviderCallback(new Headers(), "{}")).toBe(false);
  });
});

describe("Aiden mock provider and storage defaults", () => {
  it("returns a deterministic PNG without calling a paid vendor", async () => {
    const provider = new MockAidenProvider();
    const submitted = await provider.submit({
      publicRef: "KOBA-ADN-JOBTEST01",
      prompt: "crate concept",
      width: 512,
      height: 512,
      idempotencyKey: "idem-12345678",
    });
    const again = await provider.submit({
      publicRef: "KOBA-ADN-JOBTEST01",
      prompt: "crate concept",
      width: 512,
      height: 512,
      idempotencyKey: "idem-12345678",
    });
    expect(submitted.providerRequestId).toBe(again.providerRequestId);
    const result = await provider.retrieve(submitted.providerRequestId);
    expect(result.status).toBe("succeeded");
    expect(result.bytes?.equals(PNG_1X1)).toBe(true);
    expect(result.usage.costCoins).toBe(40n);
  });

  it("keeps malware scanning inactive and storage private by default", () => {
    expect(malwareScanningActive()).toBe(false);
    expect(isObjectStorageConfigured()).toBe(false);
    expect(isProtectedPath("/aiden/create")).toBe(true);
    expect(isProtectedPath("/aiden/jobs/KOBA-ADN-JOBTEST01")).toBe(true);
    expect(isSensitivePath("/api/aiden/jobs")).toBe(true);
    expect(isSensitivePath("/api/aiden/library/x/media")).toBe(true);
  });
});

describe("Aiden real provider — turned on 2026-08-18", () => {
  const envKeys = ["TRIPO_API_KEY", "REPLICATE_API_TOKEN"] as const;
  const originals = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  it("stays unconfigured with no Tripo or Replicate credentials, so getAidenProvider falls back to mock", () => {
    delete process.env.TRIPO_API_KEY;
    delete process.env.REPLICATE_API_TOKEN;
    expect(isRealAidenProviderConfigured()).toBe(false);
    expect(getAidenProvider()).toBeInstanceOf(MockAidenProvider);
  });

  it("is configured once either Tripo or Replicate has a real credential, and getAidenProvider switches to real", () => {
    delete process.env.TRIPO_API_KEY;
    process.env.REPLICATE_API_TOKEN = "r8_real_token_value";
    expect(isRealAidenProviderConfigured()).toBe(true);
    expect(getAidenProvider()).toBeInstanceOf(RealAidenProvider);
  });

  it("still treats an obvious placeholder credential as unconfigured", () => {
    process.env.TRIPO_API_KEY = "replace_me";
    delete process.env.REPLICATE_API_TOKEN;
    expect(isRealAidenProviderConfigured()).toBe(false);
  });

  it("throws rather than silently no-op-ing when submit() is given an unknown job", async () => {
    const provider = new RealAidenProvider();
    await expect(
      provider.submit({
        publicRef: "KOBA-ADN-DOES-NOT-EXIST",
        prompt: "test",
        width: 512,
        height: 512,
        idempotencyKey: "idem-99999999",
      }),
    ).rejects.toThrow(/not found/);
  });

  it("throws rather than silently no-op-ing when retrieve() is given an unknown request id", async () => {
    const provider = new RealAidenProvider();
    await expect(provider.retrieve("real_never_submitted")).rejects.toThrow(/no pending/i);
  });
});
