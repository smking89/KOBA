import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { AidenError } from "@/features/aiden/lib/errors";
import { generateAidenAssetRef, generateAidenJobRef } from "@/features/aiden/lib/refs";
import { usdToCoins } from "@/features/aiden/lib/cost";
import { coinCostForAssetType } from "@/features/aiden/lib/cost-preview";
import type { AidenAssetType, AidenAssetView, AidenJobView } from "@/features/aiden/lib/types";
import { productForAssetType, type AidenGenerationResult } from "@/features/aiden/providers/types";
import { masterAgent, AidenOsError } from "@/features/aiden/os";
import type { CreateAidenJobInput } from "@/features/aiden/schemas/aiden.schemas";
import { WalletError } from "@/features/wallet/lib/errors";
import {
  captureReservation,
  releaseReservation,
  reserveCoins,
} from "@/features/wallet/services/ledger.service";

export { coinCostForAssetType } from "@/features/aiden/lib/cost-preview";

function toJobView(job: {
  publicRef: string;
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
  state: AidenJobView["state"];
  coinCostPreview: number;
  coinCostActual: number | null;
  failureReason: string | null;
  createdAt: Date;
}): AidenJobView {
  return {
    publicRef: job.publicRef,
    prompt: job.prompt,
    game: job.game,
    platform: job.platform,
    assetType: job.assetType,
    state: job.state,
    coinCostPreview: job.coinCostPreview,
    coinCostActual: job.coinCostActual,
    failureReason: job.failureReason,
    createdAt: job.createdAt.toISOString(),
  };
}

function toAssetView(asset: {
  publicRef: string;
  title: string;
  assetType: AidenAssetType;
  technicalStatus: AidenAssetView["technicalStatus"];
  moderation: AidenAssetView["moderation"];
  game: string;
  previewLabel: string;
  assetUrl: string | null;
}): AidenAssetView {
  return {
    publicRef: asset.publicRef,
    title: asset.title,
    assetType: asset.assetType,
    technicalStatus: asset.technicalStatus,
    moderation: asset.moderation,
    game: asset.game,
    previewLabel: asset.previewLabel,
    assetUrl: asset.assetUrl,
  };
}

export async function listJobs(userId: string): Promise<AidenJobView[]> {
  const jobs = await prisma.aidenJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 48,
  });
  return jobs.map(toJobView);
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
  const coinCostPreview = coinCostForAssetType(input.assetType);
  const publicRef = generateAidenJobRef();

  let reservation: Awaited<ReturnType<typeof reserveCoins>>;
  try {
    reservation = await reserveCoins({
      userId,
      amount: coinCostPreview,
      purpose: `Aiden job ${publicRef}`,
      idempotencyKey: `aiden-job-reserve:${publicRef}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT") {
      throw new AidenError("Insufficient KOBA Coins for this generation.", "INSUFFICIENT");
    }
    throw error;
  }

  const job = await prisma.aidenJob.create({
    data: {
      publicRef,
      userId,
      prompt: input.prompt,
      game: input.game,
      platform: input.platform,
      assetType: input.assetType,
      state: "QUEUED",
      coinCostPreview,
      reservationTxId: reservation.publicRef,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.AIDEN_JOB_CREATED,
    targetType: "AidenJob",
    targetId: job.id,
    metadata: { publicRef, coinCostPreview },
    ipAddress: ipAddress ?? null,
  });

  return runGeneration(userId, publicRef, ipAddress);
}

export async function cancelJob(
  userId: string,
  publicRef: string,
  ipAddress?: string | null,
): Promise<AidenJobView> {
  const job = await prisma.aidenJob.findUnique({ where: { publicRef } });
  if (!job || job.userId !== userId) {
    throw new AidenError("Job not found.", "NOT_FOUND");
  }
  if (job.state !== "QUEUED" && job.state !== "PROCESSING") {
    throw new AidenError("Only queued or processing jobs can be cancelled.", "INVALID");
  }

  if (job.reservationTxId) {
    await releaseReservation({
      userId,
      reservationPublicRef: job.reservationTxId,
      idempotencyKey: `aiden-cancel-release:${publicRef}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  const updated = await prisma.aidenJob.update({
    where: { id: job.id },
    data: { state: "CANCELLED", reservationTxId: null },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.AIDEN_JOB_CANCELLED,
    targetType: "AidenJob",
    targetId: job.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });

  return toJobView(updated);
}

/**
 * Runs the job through Aiden Studio OS (features/aiden/os) — MasterAgent
 * routes "generation.<vest|graft|terra>" to the matching provider, wrapped
 * as an ExternalModelAdapter. Every currently-registered provider fails
 * closed (features/aiden/providers/{vest,graft,terra}-provider.ts — no
 * vendor is wired yet, see ROADMAP.md Phase 14), so today this still
 * always ends in FAILED with a specific "not configured" reason — but
 * through the real pipeline, not a hardcoded stub, so wiring a real vendor
 * later needs zero changes here.
 */
export async function runGeneration(
  userId: string,
  publicRef: string,
  ipAddress?: string | null,
): Promise<AidenJobView> {
  const job = await prisma.aidenJob.findUnique({ where: { publicRef } });
  if (!job || job.userId !== userId) {
    throw new AidenError("Job not found.", "NOT_FOUND");
  }
  if (job.state !== "QUEUED") {
    // Not a re-entry point: PROCESSING means another call already claimed
    // it (see the atomic claim below — this function has no exposed
    // retry/resume route today, but fails closed rather than silently
    // re-running a possibly-billed generation if one is ever added).
    // COMPLETED/FAILED/CANCELLED are simply returned as-is.
    return toJobView(job);
  }

  // Atomic claim: only proceeds if this call is the one that flips
  // QUEUED -> PROCESSING. A concurrent second call sees claimed.count===0
  // and returns without ever calling the (possibly billed) provider —
  // prevents two AidenAsset rows / two vendor charges for one job.
  const claimed = await prisma.aidenJob.updateMany({
    where: { id: job.id, state: "QUEUED" },
    data: { state: "PROCESSING" },
  });
  if (claimed.count === 0) {
    const current = await prisma.aidenJob.findUniqueOrThrow({ where: { id: job.id } });
    return toJobView(current);
  }

  const taskType = `generation.${productForAssetType(job.assetType).toLowerCase()}`;
  let result: AidenGenerationResult;
  let coinCostActual: number;
  try {
    result = (await masterAgent.agent({
      taskType,
      payload: {
        prompt: job.prompt,
        game: job.game,
        platform: job.platform,
        assetType: job.assetType,
      },
    })) as AidenGenerationResult;
    // Computed inside the try block, before any reservation is captured:
    // if the provider ever returns a malformed actualCostUsd, this throws
    // and is handled by the same release-and-FAIL path below, rather than
    // capturing the reservation first and only then risking an unhandled
    // throw that would leave the job stuck PROCESSING with coins already
    // taken.
    coinCostActual = usdToCoins(result.actualCostUsd);
  } catch (error) {
    const reason =
      error instanceof AidenOsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Generation failed.";

    if (job.reservationTxId) {
      await releaseReservation({
        userId,
        reservationPublicRef: job.reservationTxId,
        idempotencyKey: `aiden-fail-release:${publicRef}`,
        ...(ipAddress !== undefined ? { ipAddress } : {}),
      });
    }

    const failed = await prisma.aidenJob.update({
      where: { id: job.id },
      data: { state: "FAILED", failureReason: reason, reservationTxId: null },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.AIDEN_JOB_FAILED,
      targetType: "AidenJob",
      targetId: job.id,
      metadata: { publicRef, reason },
      ipAddress: ipAddress ?? null,
    });

    return toJobView(failed);
  }

  // Reservation is always captured in full at coinCostPreview, regardless
  // of actual cost — coinCostActual/frontierModelUsageJson are recorded
  // for audit only. Releasing the delta when actual cost < preview is a
  // deferred refinement (see the schema comment on AidenJob.coinCostActual).
  if (job.reservationTxId) {
    await captureReservation({
      userId,
      reservationPublicRef: job.reservationTxId,
      idempotencyKey: `aiden-capture:${publicRef}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  const [updatedJob] = await prisma.$transaction([
    prisma.aidenJob.update({
      where: { id: job.id },
      data: {
        state: "COMPLETED",
        coinCostActual,
        frontierModelUsageJson: JSON.stringify(result.usage),
      },
    }),
    prisma.aidenAsset.create({
      data: {
        publicRef: generateAidenAssetRef(),
        userId,
        jobId: job.id,
        title: `${job.game} ${job.assetType}`,
        assetType: job.assetType,
        technicalStatus: "PREVIEW",
        moderation: "PRIVATE",
        game: job.game,
        previewLabel: result.previewLabel,
        assetUrl: result.assetUrl,
      },
    }),
  ]);

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.AIDEN_JOB_COMPLETED,
    targetType: "AidenJob",
    targetId: job.id,
    metadata: { publicRef, coinCostActual },
    ipAddress: ipAddress ?? null,
  });

  return toJobView(updatedJob);
}

export async function publishToShopRequest(
  userId: string,
  publicRef: string,
): Promise<AidenAssetView> {
  const asset = await prisma.aidenAsset.findUnique({ where: { publicRef } });
  if (!asset || asset.userId !== userId) {
    throw new AidenError("Asset not found.", "NOT_FOUND");
  }
  if (asset.technicalStatus === "CONCEPT_ONLY") {
    throw new AidenError("Concept-only assets cannot be submitted for shop review.", "INVALID");
  }

  const updated = await prisma.aidenAsset.update({
    where: { id: asset.id },
    data: { moderation: "PENDING_REVIEW" },
  });

  return toAssetView(updated);
}

/** Optional helper for tests that want a CONCEPT_ONLY asset without provider. */
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
