import { createHash } from "node:crypto";
import { AuditAction, Prisma, type AidenFailureClass } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { AidenError } from "@/features/aiden/lib/errors";
import { resolveActiveAidenIdentity } from "@/features/aiden/lib/identity";
import { moderateAidenPrompt } from "@/features/aiden/lib/moderation";
import {
  readPngSize,
  sniffImageMime,
  validateImageLimits,
} from "@/features/aiden/lib/output-validation";
import { scanGeneratedBytes } from "@/features/aiden/lib/malware-scan";
import {
  allowAidenCostOverrun,
  aidenModelName,
  aidenModelVersion,
  aidenProviderId,
  estimateAidenCost,
  isAidenGenerationTypeActive,
} from "@/features/aiden/lib/pricing";
import {
  getAidenProvider,
  type AidenGenerationProvider,
  type AidenProviderResult,
} from "@/features/aiden/lib/provider";
import { generateAidenAssetRef, generateAidenJobRef } from "@/features/aiden/lib/refs";
import { fetchProviderBytes } from "@/features/aiden/lib/safe-fetch";
import { assertAidenTransition, canTransitionAidenJob } from "@/features/aiden/lib/state-machine";
import { signAidenObjectUrl, storeAidenObject } from "@/features/aiden/lib/storage";
import {
  isSuccessfulAidenState,
  isTerminalAidenState,
  type AidenAssetType,
  type AidenAssetView,
  type AidenJobState,
  type AidenJobView,
  type AidenTechnicalStatus,
} from "@/features/aiden/lib/types";
import type { CreateAidenJobInput } from "@/features/aiden/schemas/aiden.schemas";
import { WalletError } from "@/features/wallet/lib/errors";
import {
  getWalletSummary,
  releaseReservation,
  reserveCoins,
  settleReservation,
} from "@/features/wallet/services/ledger.service";

const STALE_MS = 2 * 60 * 1000;

function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function toJobView(job: {
  publicRef: string;
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
  state: AidenJobState;
  coinCostPreview: number;
  estimatedCostCoins: bigint;
  actualCostCoins: bigint | null;
  provider: string;
  model: string;
  modelVersion: string;
  failureReason: string | null;
  createdAt: Date;
  asset?: { publicRef: string; technicalStatus: AidenTechnicalStatus } | null;
}): AidenJobView {
  return {
    publicRef: job.publicRef,
    prompt: job.prompt,
    game: job.game,
    platform: job.platform,
    assetType: job.assetType,
    state: job.state,
    coinCostPreview: job.coinCostPreview,
    estimatedCostCoins: job.estimatedCostCoins.toString(),
    actualCostCoins: job.actualCostCoins?.toString() ?? null,
    provider: job.provider,
    model: job.model,
    modelVersion: job.modelVersion,
    readiness: job.asset?.technicalStatus ?? "CONCEPT_ONLY",
    failureReason: job.failureReason,
    createdAt: job.createdAt.toISOString(),
    assetPublicRef: job.asset?.publicRef ?? null,
  };
}

function toAssetView(asset: {
  publicRef: string;
  title: string;
  assetType: AidenAssetType;
  technicalStatus: AidenTechnicalStatus;
  moderation: AidenAssetView["moderation"];
  game: string;
  previewLabel: string;
  provider: string | null;
  model: string | null;
  createdAt: Date;
}): AidenAssetView {
  return {
    publicRef: asset.publicRef,
    title: asset.title,
    assetType: asset.assetType,
    technicalStatus: asset.technicalStatus,
    moderation: asset.moderation,
    game: asset.game,
    previewLabel: asset.previewLabel,
    provider: asset.provider,
    model: asset.model,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function estimateJobCost(input: {
  assetType: AidenAssetType;
  width?: number | undefined;
  height?: number | undefined;
  quality?: "standard" | "hd" | undefined;
  count?: number | undefined;
}) {
  const estimate = estimateAidenCost(input);
  return {
    ...estimate,
    estimatedCostCoins: estimate.estimatedCostCoinsText,
    active: estimate.active,
  };
}

export async function listJobs(userId: string): Promise<AidenJobView[]> {
  const jobs = await prisma.aidenJob.findMany({
    where: { userId },
    include: { asset: { select: { publicRef: true, technicalStatus: true } } },
    orderBy: { createdAt: "desc" },
    take: 48,
  });
  return jobs.map(toJobView);
}

export async function getJob(userId: string, publicRef: string): Promise<AidenJobView> {
  const job = await prisma.aidenJob.findUnique({
    where: { publicRef },
    include: { asset: { select: { publicRef: true, technicalStatus: true } } },
  });
  if (!job || job.userId !== userId) {
    throw new AidenError("Job not found.", "NOT_FOUND");
  }
  return toJobView(job);
}

export async function listLibrary(userId: string): Promise<AidenAssetView[]> {
  const assets = await prisma.aidenAsset.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 64,
  });
  return assets.map(toAssetView);
}

export async function createJob(
  userId: string,
  input: CreateAidenJobInput,
  ipAddress?: string | null,
): Promise<AidenJobView> {
  const assetType = input.assetType ?? "CONCEPT_IMAGE";
  if (!isAidenGenerationTypeActive(assetType)) {
    throw new AidenError("Only concept image generation is available in this phase.", "INVALID");
  }

  const moderation = moderateAidenPrompt(input.prompt);
  if (moderation.status === "BLOCKED") {
    throw new AidenError(moderation.reason, "INVALID");
  }

  if (input.idempotencyKey) {
    const existing = await prisma.aidenJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { asset: { select: { publicRef: true, technicalStatus: true } } },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new AidenError("Idempotency key already used.", "CONFLICT");
      }
      return toJobView(existing);
    }
  }

  const identity = await resolveActiveAidenIdentity(userId);
  const estimate = estimateAidenCost({
    assetType,
    width: input.width,
    height: input.height,
    quality: input.quality,
    count: 1,
  });
  const publicRef = generateAidenJobRef();
  const settings = {
    width: input.width ?? 512,
    height: input.height ?? 512,
    quality: input.quality ?? "standard",
    count: 1,
  };

  let reservation: Awaited<ReturnType<typeof reserveCoins>>;
  try {
    reservation = await reserveCoins({
      userId,
      amount: estimate.estimatedCostCoins,
      purpose: `Aiden job ${publicRef}`,
      idempotencyKey: `aiden-job-reserve:${input.idempotencyKey}`,
      metadata: { publicRef, assetType },
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT") {
      throw new AidenError("Insufficient KOBA Coins for this generation.", "INSUFFICIENT");
    }
    throw error;
  }

  const preview =
    estimate.estimatedCostCoins <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(estimate.estimatedCostCoins)
      : Number.MAX_SAFE_INTEGER;

  try {
    const job = await prisma.aidenJob.create({
      data: {
        publicRef,
        userId,
        kobaIdentityId: identity.identityId,
        prompt: input.prompt,
        promptHash: promptHash(input.prompt),
        game: input.game,
        platform: input.platform,
        assetType,
        settingsJson: JSON.stringify(settings),
        state: "QUEUED",
        coinCostPreview: preview,
        estimatedCostCoins: estimate.estimatedCostCoins,
        reservationPublicRef: reservation.publicRef,
        reservationTxId: reservation.publicRef,
        provider: aidenProviderId(),
        model: aidenModelName(),
        modelVersion: aidenModelVersion(),
        idempotencyKey: input.idempotencyKey,
        promptModeration: "ALLOWED",
        runAfter: new Date(),
      },
      include: { asset: { select: { publicRef: true, technicalStatus: true } } },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.AIDEN_JOB_CREATED,
      targetType: "AidenJob",
      targetId: job.id,
      metadata: { publicRef, estimatedCostCoins: estimate.estimatedCostCoinsText },
      ipAddress: ipAddress ?? null,
    });

    return toJobView(job);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.aidenJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { asset: { select: { publicRef: true, technicalStatus: true } } },
      });
      if (existing && existing.userId === userId) {
        return toJobView(existing);
      }
    }
    await releaseReservation({
      userId,
      reservationPublicRef: reservation.publicRef,
      idempotencyKey: `aiden-create-fail-release:${publicRef}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    }).catch(() => undefined);
    throw error;
  }
}

export async function cancelJob(
  userId: string,
  publicRef: string,
  ipAddress?: string | null,
): Promise<AidenJobView> {
  const job = await prisma.aidenJob.findUnique({
    where: { publicRef },
    include: { asset: { select: { publicRef: true, technicalStatus: true } } },
  });
  if (!job || job.userId !== userId) {
    throw new AidenError("Job not found.", "NOT_FOUND");
  }
  if (job.userId !== userId) {
    throw new AidenError("Not allowed to cancel this job.", "FORBIDDEN");
  }
  if (isTerminalAidenState(job.state)) {
    throw new AidenError("This job can no longer be cancelled.", "INVALID");
  }
  if (!canTransitionAidenJob(job.state, "CANCELLED") && job.state !== "PROCESSING") {
    throw new AidenError("This job can no longer be cancelled.", "INVALID");
  }

  if (job.state === "PROCESSING") {
    const updated = await prisma.aidenJob.update({
      where: { id: job.id },
      data: { cancelRequestedAt: new Date() },
      include: { asset: { select: { publicRef: true, technicalStatus: true } } },
    });
    return toJobView(updated);
  }

  await failOrCancelJob(job, "CANCELLED", "Cancelled by owner.", "CANCELLED", ipAddress);
  return getJob(userId, publicRef);
}

async function failOrCancelJob(
  job: {
    id: string;
    publicRef: string;
    userId: string;
    state: AidenJobState;
    reservationPublicRef: string | null;
    reservationTxId: string | null;
    version: number;
  },
  next: "FAILED" | "CANCELLED",
  reason: string,
  failureClass: AidenFailureClass,
  ipAddress?: string | null,
) {
  assertAidenTransition(job.state, next);
  const reservationRef = job.reservationPublicRef ?? job.reservationTxId;
  if (reservationRef) {
    await releaseReservation({
      userId: job.userId,
      reservationPublicRef: reservationRef,
      idempotencyKey: `aiden-${next.toLowerCase()}-release:${job.publicRef}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }
  await prisma.aidenJob.update({
    where: { id: job.id },
    data: {
      state: next,
      failureReason: reason,
      failureClass,
      reservationPublicRef: null,
      reservationTxId: null,
      claimedAt: null,
      version: { increment: 1 },
    },
  });
  await writeAuditLog({
    actorUserId: job.userId,
    action:
      next === "CANCELLED" ? AuditAction.AIDEN_JOB_CANCELLED : AuditAction.AIDEN_JOB_COMPLETED,
    targetType: "AidenJob",
    targetId: job.id,
    metadata: { publicRef: job.publicRef, state: next, failureClass },
    ipAddress: ipAddress ?? null,
  });
}

export async function publishToShopRequest(
  userId: string,
  publicRef: string,
): Promise<AidenAssetView> {
  const asset = await prisma.aidenAsset.findUnique({ where: { publicRef } });
  if (!asset || asset.userId !== userId) {
    throw new AidenError("Asset not found.", "NOT_FOUND");
  }
  if (asset.technicalStatus === "VALIDATION_FAILED") {
    throw new AidenError("This asset failed validation and cannot be submitted.", "INVALID");
  }
  if (asset.moderation === "PENDING_REVIEW" || asset.moderation === "APPROVED") {
    return toAssetView(asset);
  }

  const updated = await prisma.aidenAsset.update({
    where: { id: asset.id },
    data: { moderation: "PENDING_REVIEW" },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.AIDEN_ASSET_REVIEW_SUBMITTED,
    targetType: "AidenAsset",
    targetId: asset.id,
    metadata: {
      publicRef,
      generatedByAiden: true,
      provider: asset.provider,
      model: asset.model,
      modelVersion: asset.modelVersion,
      assetType: asset.assetType,
      readiness: asset.technicalStatus,
    },
  });

  return toAssetView(updated);
}

export async function getAssetMedia(userId: string, publicRef: string) {
  const asset = await prisma.aidenAsset.findUnique({
    where: { publicRef },
    include: { job: true },
  });
  if (!asset || asset.userId !== userId) {
    throw new AidenError("Asset not found.", "NOT_FOUND");
  }
  if (asset.storageKey && !asset.job?.outputBytes) {
    const url = await signAidenObjectUrl(asset.storageKey, 120);
    if (url) return { mode: "redirect" as const, url, mime: asset.mimeType ?? "image/png" };
  }
  const bytes = asset.job?.outputBytes;
  if (!bytes) {
    throw new AidenError("Preview is not available.", "NOT_FOUND");
  }
  return { mode: "bytes" as const, bytes: Buffer.from(bytes), mime: asset.mimeType ?? "image/png" };
}

export async function createConceptAssetStub(
  userId: string,
  input: { title: string; game: string; assetType: AidenAssetType },
): Promise<AidenAssetView> {
  const asset = await prisma.aidenAsset.create({
    data: {
      publicRef: generateAidenAssetRef(),
      userId,
      title: input.title,
      assetType: input.assetType,
      technicalStatus: "CONCEPT_ONLY",
      moderation: "PRIVATE",
      game: input.game,
      previewLabel: "Concept board",
    },
  });
  return toAssetView(asset);
}

export async function getAidenWalletPreview(userId: string) {
  const wallet = await getWalletSummary(userId);
  return { available: wallet.available, reserved: wallet.reserved, total: wallet.total };
}

export async function claimQueuedJobs(opts?: { limit?: number; workerId?: string; now?: Date }) {
  const now = opts?.now ?? new Date();
  const workerId = opts?.workerId ?? "aiden-worker";
  const staleBefore = new Date(now.getTime() - STALE_MS);
  const candidates = await prisma.aidenJob.findMany({
    where: {
      OR: [
        { state: "QUEUED", runAfter: { lte: now } },
        { state: "PROCESSING", claimedAt: { lte: staleBefore } },
      ],
    },
    orderBy: { runAfter: "asc" },
    take: opts?.limit ?? 8,
  });

  const claimed = [];
  for (const job of candidates) {
    if (job.attempts >= job.maxAttempts) {
      await failOrCancelJob(job, "FAILED", "Maximum attempts exceeded.", "PROVIDER");
      continue;
    }
    const updated = await prisma.aidenJob.updateMany({
      where: { id: job.id, version: job.version, state: { in: ["QUEUED", "PROCESSING"] } },
      data: {
        state: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        attempts: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      claimed.push(job.publicRef);
    }
  }
  return claimed;
}

export async function processClaimedJob(
  publicRef: string,
  opts?: { provider?: AidenGenerationProvider },
) {
  const job = await prisma.aidenJob.findUnique({ where: { publicRef } });
  if (!job) return { publicRef, skipped: true as const };
  if (isSuccessfulAidenState(job.state) || job.state === "FAILED" || job.state === "CANCELLED") {
    return { publicRef, skipped: true as const, state: job.state };
  }
  if (job.cancelRequestedAt) {
    await failOrCancelJob(job, "CANCELLED", "Cancelled by owner.", "CANCELLED");
    return { publicRef, state: "CANCELLED" as const };
  }

  const settings = JSON.parse(job.settingsJson || "{}") as {
    width?: number;
    height?: number;
  };
  const provider = opts?.provider ?? getAidenProvider();

  try {
    const submitted = await provider.submit({
      publicRef: job.publicRef,
      prompt: job.prompt,
      width: settings.width ?? 512,
      height: settings.height ?? 512,
      idempotencyKey: job.idempotencyKey ?? job.publicRef,
    });

    const existingProvider = await prisma.aidenJob.findFirst({
      where: { providerRequestId: submitted.providerRequestId, NOT: { id: job.id } },
    });
    if (existingProvider) {
      throw new AidenError("Duplicate provider request.", "CONFLICT");
    }

    await prisma.aidenJob.update({
      where: { id: job.id },
      data: { providerRequestId: submitted.providerRequestId, state: "MODERATING" },
    });

    const result = await provider.retrieve(submitted.providerRequestId);
    await completeFromProvider(job.publicRef, result);
    return { publicRef, state: "SUCCEEDED" as const };
  } catch (error) {
    const latest = await prisma.aidenJob.findUnique({ where: { publicRef } });
    if (!latest || isTerminalAidenState(latest.state)) {
      return { publicRef, skipped: true as const };
    }
    const reason = error instanceof Error ? error.message.slice(0, 240) : "Generation failed.";
    if (latest.attempts >= latest.maxAttempts) {
      await failOrCancelJob(latest, "FAILED", reason, "PROVIDER");
      return { publicRef, state: "FAILED" as const };
    }
    const backoffMs = Math.min(60_000, 2 ** latest.attempts * 1000);
    assertAidenTransition(latest.state, "QUEUED");
    await prisma.aidenJob.update({
      where: { id: latest.id },
      data: {
        state: "QUEUED",
        runAfter: new Date(Date.now() + backoffMs),
        claimedAt: null,
        failureReason: reason,
        failureClass: "PROVIDER",
        version: { increment: 1 },
      },
    });
    return { publicRef, state: "QUEUED" as const, retry: true as const };
  }
}

export async function completeFromProvider(publicRef: string, result: AidenProviderResult) {
  let job = await prisma.aidenJob.findUnique({ where: { publicRef } });
  if (!job) throw new AidenError("Job not found.", "NOT_FOUND");
  if (isSuccessfulAidenState(job.state)) {
    return getJob(job.userId, publicRef);
  }
  if (job.state === "CANCELLED" || job.state === "FAILED") {
    return toJobView({ ...job, asset: null });
  }
  if (job.state !== "PROCESSING" && job.state !== "MODERATING") {
    throw new AidenError("Job is not ready to complete.", "INVALID");
  }

  if (result.status !== "succeeded") {
    await failOrCancelJob(job, "FAILED", result.error ?? "Provider failed.", "PROVIDER");
    return getJob(job.userId, publicRef);
  }

  if (job.state === "PROCESSING") {
    assertAidenTransition(job.state, "MODERATING");
    await prisma.aidenJob.update({
      where: { id: job.id },
      data: { state: "MODERATING" },
    });
    job = { ...job, state: "MODERATING" };
  }

  let bytes = result.bytes ?? null;
  if (!bytes && result.remoteUrl) {
    try {
      bytes = await fetchProviderBytes(result.remoteUrl);
    } catch {
      await failOrCancelJob(job, "FAILED", "Provider output URL was rejected.", "VALIDATION");
      return getJob(job.userId, publicRef);
    }
  }
  if (!bytes) {
    await failOrCancelJob(job, "FAILED", "Provider returned no image bytes.", "VALIDATION");
    return getJob(job.userId, publicRef);
  }

  const sniffed = sniffImageMime(bytes) ?? "";
  const pngSize = readPngSize(bytes);
  const limits = validateImageLimits({
    mime: sniffed,
    byteSize: bytes.byteLength,
    width: pngSize?.width ?? result.width,
    height: pngSize?.height ?? result.height,
  });
  if (!limits.ok) {
    await failOrCancelJob(job, "FAILED", limits.reason, "VALIDATION");
    return getJob(job.userId, publicRef);
  }

  const scan = await scanGeneratedBytes(bytes, sniffed);
  if (scan.scanned && !scan.clean) {
    await failOrCancelJob(
      job,
      "FAILED",
      scan.reason ?? "Malware scan rejected output.",
      "VALIDATION",
    );
    return getJob(job.userId, publicRef);
  }

  const actual = result.usage.costCoins;
  const estimated = job.estimatedCostCoins;
  if (actual > estimated && !allowAidenCostOverrun()) {
    await failOrCancelJob(job, "FAILED", "Provider cost exceeded the reserved estimate.", "COST");
    return getJob(job.userId, publicRef);
  }

  const stored = await storeAidenObject({
    userId: job.userId,
    publicRef: job.publicRef,
    mime: sniffed,
    bytes,
  });

  assertAidenTransition(job.state, "SUCCEEDED");

  const reservationRef = job.reservationPublicRef ?? job.reservationTxId;
  if (reservationRef) {
    await settleReservation({
      userId: job.userId,
      reservationPublicRef: reservationRef,
      captureAmount: actual <= estimated ? actual : estimated,
      idempotencyKey: `aiden-settle:${job.publicRef}`,
    });
  }

  const asset = await prisma.aidenAsset.upsert({
    where: { jobId: job.id },
    create: {
      publicRef: generateAidenAssetRef(),
      userId: job.userId,
      jobId: job.id,
      title: `${job.game} concept`,
      assetType: job.assetType,
      technicalStatus: "CONCEPT_ONLY",
      moderation: "PRIVATE",
      game: job.game,
      previewLabel: "Concept still",
      storageKey: stored.key,
      mimeType: sniffed,
      byteSize: bytes.byteLength,
      width: pngSize?.width ?? result.width ?? null,
      height: pngSize?.height ?? result.height ?? null,
      provider: job.provider,
      model: result.model,
      modelVersion: result.modelVersion,
      provenanceJson: JSON.stringify({
        generatedByAiden: true,
        provider: job.provider,
        model: result.model,
        modelVersion: result.modelVersion,
        generationType: job.assetType,
        readiness: "CONCEPT",
        createdAt: new Date().toISOString(),
      }),
    },
    update: {},
  });

  await prisma.aidenJob.update({
    where: { id: job.id },
    data: {
      state: "SUCCEEDED",
      actualCostCoins: actual <= estimated ? actual : estimated,
      outputStorageKey: stored.key,
      outputMime: sniffed,
      outputBytes: stored.stored === "inline" ? new Uint8Array(bytes) : null,
      outputByteSize: bytes.byteLength,
      outputWidth: pngSize?.width ?? result.width ?? null,
      outputHeight: pngSize?.height ?? result.height ?? null,
      outputModeration: "CLEAR",
      claimedAt: null,
      version: { increment: 1 },
    },
  });

  await writeAuditLog({
    actorUserId: job.userId,
    action: AuditAction.AIDEN_JOB_COMPLETED,
    targetType: "AidenJob",
    targetId: job.id,
    metadata: { publicRef: job.publicRef, assetRef: asset.publicRef, scanned: scan.scanned },
  });

  return getJob(job.userId, publicRef);
}

export { canTransitionAidenJob };
