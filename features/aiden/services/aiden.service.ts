import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { AidenError } from "@/features/aiden/lib/errors";
import { generateAidenAssetRef, generateAidenJobRef } from "@/features/aiden/lib/refs";
import type { AidenAssetType, AidenAssetView, AidenJobView } from "@/features/aiden/lib/types";
import type { CreateAidenJobInput } from "@/features/aiden/schemas/aiden.schemas";
import { WalletError } from "@/features/wallet/lib/errors";
import {
  releaseReservation,
  reserveCoinsForGeneration,
} from "@/features/wallet/services/ledger.service";

const ASSET_COST: Record<AidenAssetType, number> = {
  CONCEPT_IMAGE: 40,
  SKIN: 40,
  TEXTURE: 50,
  PROP: 60,
  ANIMATION: 80,
  TERRAIN: 120,
  MAP: 120,
};

export function coinCostForAssetType(assetType: AidenAssetType): number {
  return ASSET_COST[assetType] ?? 40;
}

function toJobView(job: {
  publicRef: string;
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
  state: AidenJobView["state"];
  coinCostPreview: number;
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
}): AidenAssetView {
  return {
    publicRef: asset.publicRef,
    title: asset.title,
    assetType: asset.assetType,
    technicalStatus: asset.technicalStatus,
    moderation: asset.moderation,
    game: asset.game,
    previewLabel: asset.previewLabel,
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

  let reservation: Awaited<ReturnType<typeof reserveCoinsForGeneration>>;
  try {
    reservation = await reserveCoinsForGeneration(
      userId,
      coinCostPreview,
      `Reserved for Aiden job ${publicRef}`,
      ipAddress,
    );
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
      reservationTxId: reservation.transactionId,
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

  // Prefer fail stub so coins are not stuck without a provider
  return processJobStub(userId, publicRef, ipAddress);
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
    await releaseReservation(
      userId,
      job.coinCostPreview,
      `Released reservation for cancelled Aiden job ${publicRef}`,
      ipAddress,
    );
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

export async function processJobStub(
  userId: string,
  publicRef: string,
  ipAddress?: string | null,
): Promise<AidenJobView> {
  const job = await prisma.aidenJob.findUnique({ where: { publicRef } });
  if (!job || job.userId !== userId) {
    throw new AidenError("Job not found.", "NOT_FOUND");
  }
  if (job.state !== "QUEUED" && job.state !== "PROCESSING") {
    return toJobView(job);
  }

  if (job.reservationTxId) {
    await releaseReservation(
      userId,
      job.coinCostPreview,
      `Released reservation for failed Aiden job ${publicRef}`,
      ipAddress,
    );
  }

  const updated = await prisma.aidenJob.update({
    where: { id: job.id },
    data: {
      state: "FAILED",
      failureReason: "AI provider not connected in this phase",
      reservationTxId: null,
    },
  });

  return toJobView(updated);
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
