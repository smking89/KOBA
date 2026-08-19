import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AidenAssetType } from "@/features/aiden/lib/types";
import { aidenModelName, aidenModelVersion } from "@/features/aiden/lib/pricing";
import { usdToCoins } from "@/features/aiden/lib/cost";
import { fetchProviderBytes } from "@/features/aiden/lib/safe-fetch";
import { sniffImageMime, AIDEN_MAX_MESH_BYTES, AIDEN_MESH_ACCEPT } from "@/features/aiden/lib/output-validation";
import { getProvider } from "@/features/aiden/providers/registry";
import { productForAssetType } from "@/features/aiden/providers/types";
import { generatePbrMapSet } from "@/features/aiden/lib/pbr-maps";
import { assembleSkinAsset, AidenBlenderNotConfiguredError } from "@/features/aiden/lib/blender-assembly";

export type AidenProviderUsage = {
  units: bigint;
  costCoins: bigint;
};

export type AidenProviderResult = {
  providerRequestId: string;
  status: "succeeded" | "failed";
  mime?: string;
  bytes?: Buffer;
  remoteUrl?: string;
  width?: number;
  height?: number;
  usage: AidenProviderUsage;
  model: string;
  modelVersion: string;
  error?: string;
};

export type AidenProviderSubmitInput = {
  publicRef: string;
  prompt: string;
  width: number;
  height: number;
  idempotencyKey: string;
};

export type AidenGenerationProvider = {
  id: string;
  submit(input: AidenProviderSubmitInput): Promise<{ providerRequestId: string }>;
  retrieve(providerRequestId: string): Promise<AidenProviderResult>;
};

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export class MockAidenProvider implements AidenGenerationProvider {
  readonly id = "mock";

  async submit(input: AidenProviderSubmitInput): Promise<{ providerRequestId: string }> {
    const digest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16);
    return { providerRequestId: `mock_${digest}` };
  }

  async retrieve(providerRequestId: string): Promise<AidenProviderResult> {
    return {
      providerRequestId,
      status: "succeeded",
      mime: "image/png",
      bytes: PNG_1X1,
      width: 1,
      height: 1,
      usage: { units: 1n, costCoins: 40n },
      model: aidenModelName(),
      modelVersion: aidenModelVersion(),
    };
  }
}

/**
 * Client, 2026-08-18: turned on for real, replacing the mock that had
 * shipped with the comment "No production adapter is wired in this
 * phase" — every Aiden generation before this returned a hardcoded
 * 1x1 PNG regardless of asset type. Bridges the two-phase submit/
 * retrieve interface this file's callers expect onto
 * features/aiden/providers/{vest,graft,terra}-provider.ts's simpler
 * single-call generate() — submit() and retrieve() are always called
 * back-to-back within the same processClaimedJob() invocation (no
 * webhook path is active, verifyAidenProviderCallback always returns
 * false), so an in-memory pending map is safe: nothing needs to
 * survive a process restart between the two calls.
 *
 * submit()'s interface (AidenProviderSubmitInput) doesn't carry
 * assetType/game/platform, so this looks the job row up by publicRef
 * rather than widening that interface for every other caller.
 */
export class RealAidenProvider implements AidenGenerationProvider {
  readonly id = "real";
  private readonly pending = new Map<string, () => Promise<AidenProviderResult>>();

  async submit(input: AidenProviderSubmitInput): Promise<{ providerRequestId: string }> {
    const job = await prisma.aidenJob.findUnique({ where: { publicRef: input.publicRef } });
    if (!job) {
      throw new Error(`Aiden job ${input.publicRef} not found for real provider submission.`);
    }
    const digest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16);
    const providerRequestId = `real_${digest}`;
    this.pending.set(providerRequestId, () =>
      runRealGeneration({ prompt: input.prompt, game: job.game, platform: job.platform, assetType: job.assetType }),
    );
    return { providerRequestId };
  }

  async retrieve(providerRequestId: string): Promise<AidenProviderResult> {
    const run = this.pending.get(providerRequestId);
    if (!run) {
      throw new Error(`No pending real Aiden generation for ${providerRequestId}.`);
    }
    this.pending.delete(providerRequestId);
    return run();
  }
}

async function runRealGeneration(input: {
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
}): Promise<AidenProviderResult> {
  const product = productForAssetType(input.assetType);
  const provider = getProvider(product);
  if (!provider.isConfigured()) {
    return {
      providerRequestId: "n/a",
      status: "failed",
      error: `${product} has no configured generation provider.`,
      usage: { units: 0n, costCoins: 0n },
      model: aidenModelName(),
      modelVersion: aidenModelVersion(),
    };
  }

  const generated = await provider.generate({
    prompt: input.prompt,
    game: input.game,
    platform: input.platform,
    assetType: input.assetType,
  });

  let totalCostUsd = generated.actualCostUsd;
  let bytes: Buffer;
  let mime: string;

  if (input.assetType === "SKIN") {
    // generated.assetUrl is Tripo's already-textured, rigged mesh.
    // Layer on the three Kandinsky PBR maps and try to assemble a
    // final .glb via Blender — falls back to the bare mesh if Blender
    // isn't configured on this host (AidenBlenderNotConfiguredError),
    // rather than failing the whole job over a missing optional
    // enhancement. The Kandinsky spend already happened either way,
    // so its cost is always counted, fallback or not.
    const pbr = await generatePbrMapSet(input.prompt);
    totalCostUsd += pbr.totalCostUsd;
    try {
      const assembled = await assembleSkinAsset({
        meshUrl: generated.assetUrl,
        normalMapUrl: pbr.normalMapUrl,
        specularMapUrl: pbr.specularMapUrl,
        emissionMapUrl: pbr.emissionMapUrl,
      });
      bytes = assembled.bytes;
      mime = assembled.mime;
    } catch (error) {
      if (!(error instanceof AidenBlenderNotConfiguredError)) {
        throw error;
      }
      bytes = await fetchProviderBytes(generated.assetUrl, {
        accept: AIDEN_MESH_ACCEPT,
        maxBytes: AIDEN_MAX_MESH_BYTES,
      });
      mime = "model/gltf-binary";
    }
  } else {
    bytes = await fetchProviderBytes(generated.assetUrl);
    mime = sniffImageMime(bytes) ?? "image/png";
  }

  return {
    providerRequestId: `real-${Date.now()}`,
    status: "succeeded",
    mime,
    bytes,
    usage: { units: 1n, costCoins: BigInt(Math.max(0, usdToCoins(totalCostUsd))) },
    model: product,
    modelVersion: "1",
  };
}

/**
 * Provider callbacks are rejected unless a webhook secret is configured and verified.
 * Neither the mock nor the real provider sends callbacks; workers poll `retrieve` instead.
 */
export function verifyAidenProviderCallback(headers: Headers, rawBody: string): boolean {
  void headers;
  void rawBody;
  const secret = process.env.AIDEN_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!secret || secret.includes("replace")) {
    return false;
  }
  return false;
}

export function getAidenProvider(): AidenGenerationProvider {
  if (!isRealAidenProviderConfigured()) {
    return new MockAidenProvider();
  }
  return new RealAidenProvider();
}

/** True once at least one of the underlying Vest/Graft/Terra
 * providers has real credentials — not a single generic
 * AIDEN_PROVIDER_API_KEY, since this system is genuinely multi-vendor
 * (Tripo for mesh work, Replicate for SDXL/Kandinsky images), not one
 * provider behind one key. */
export function isRealAidenProviderConfigured(): boolean {
  return (["VEST", "GRAFT", "TERRA"] as const).some((product) => getProvider(product).isConfigured());
}
