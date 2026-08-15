import { AuditAction, type DevReviewState } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  canStaffApproveListing,
  canStaffModerateContent,
  canStaffVerifyShop,
} from "@/features/admin/lib/access";
import { DeveloperError } from "@/features/developers/lib/errors";
import { assertDevProductTransition } from "@/features/developers/lib/state-machine";
import { enqueueWebhookEvent } from "@/features/developers/services/webhook.service";

async function loadActorTypes(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  return actor?.kobaIdentities.map((row) => row.accountType) ?? [];
}

async function requireListingStaff(userId: string) {
  const types = await loadActorTypes(userId);
  if (!canStaffApproveListing(types) && !canStaffModerateContent(types)) {
    throw new DeveloperError("Staff only.", "FORBIDDEN");
  }
  return types;
}

export async function listPendingDeveloperProducts(actorUserId: string) {
  await requireListingStaff(actorUserId);
  return prisma.devProduct.findMany({
    where: { reviewState: { in: ["SUBMITTED", "IN_REVIEW", "SECURITY_REVIEW"] } },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: {
      profile: { select: { slug: true, displayName: true, verified: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          artifacts: {
            select: { filename: true, mimeType: true, byteSize: true, sha256: true, status: true },
          },
        },
      },
    },
  });
}

export async function moderateDeveloperProduct(
  actorUserId: string,
  publicRef: string,
  action:
    "in_review" | "request_changes" | "approve" | "publish" | "reject" | "suspend" | "archive",
  reason: string,
  ipAddress?: string | null,
) {
  const types = await requireListingStaff(actorUserId);
  if ((action === "approve" || action === "publish") && !canStaffApproveListing(types)) {
    throw new DeveloperError("Listing approval permission required.", "FORBIDDEN");
  }
  if (!reason.trim()) throw new DeveloperError("A moderation reason is required.", "INVALID");
  const product = await prisma.devProduct.findUnique({ where: { publicRef } });
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");

  const next: Record<typeof action, DevReviewState> = {
    in_review: "IN_REVIEW",
    request_changes: "CHANGES_REQUESTED",
    approve: "APPROVED",
    publish: "PUBLISHED",
    reject: "REJECTED",
    suspend: "SUSPENDED",
    archive: "ARCHIVED",
  };
  const nextState = next[action];
  assertDevProductTransition(product.reviewState, nextState);

  const updated = await prisma.devProduct.update({
    where: { id: product.id },
    data: {
      reviewState: nextState,
      moderationNote: reason.trim(),
      publishedAt: nextState === "PUBLISHED" ? new Date() : product.publishedAt,
      suspendedAt: nextState === "SUSPENDED" ? new Date() : null,
    },
  });

  const auditAction =
    nextState === "APPROVED" || nextState === "PUBLISHED"
      ? AuditAction.DEV_PRODUCT_APPROVED
      : nextState === "REJECTED"
        ? AuditAction.DEV_PRODUCT_REJECTED
        : nextState === "SUSPENDED"
          ? AuditAction.DEV_PRODUCT_SUSPENDED
          : AuditAction.DEV_PRODUCT_SUBMITTED;

  await writeAuditLog({
    actorUserId,
    action: auditAction,
    targetType: "DevProduct",
    targetId: product.id,
    metadata: {
      publicRef,
      previous: product.reviewState,
      next: nextState,
      reason: reason.trim(),
    },
    ipAddress: ipAddress ?? null,
  });
  await enqueueWebhookEvent({
    eventType: "product.updated",
    data: { slug: product.slug, reviewState: nextState },
  }).catch(() => undefined);
  return {
    publicRef: updated.publicRef,
    reviewState: updated.reviewState,
    previous: product.reviewState,
  };
}

export async function moderateDeveloperVersion(
  actorUserId: string,
  versionRef: string,
  action: "approve" | "reject",
  reason: string,
  ipAddress?: string | null,
) {
  await requireListingStaff(actorUserId);
  if (!reason.trim()) throw new DeveloperError("A moderation reason is required.", "INVALID");
  const version = await prisma.devProductVersion.findUnique({
    where: { publicRef: versionRef },
    include: { artifacts: true, product: true },
  });
  if (!version) throw new DeveloperError("Version not found.", "NOT_FOUND");
  const nextState = action === "approve" ? "APPROVED" : "REJECTED";
  await prisma.devProductVersion.update({
    where: { id: version.id },
    data: {
      reviewState: nextState,
      releasedAt: action === "approve" ? new Date() : version.releasedAt,
    },
  });
  if (action === "approve") {
    await prisma.devProductArtifact.updateMany({
      where: { versionId: version.id, status: "QUARANTINE" },
      data: { status: "APPROVED" },
    });
  }
  await writeAuditLog({
    actorUserId,
    action: AuditAction.DEV_VERSION_APPROVED,
    targetType: "DevProductVersion",
    targetId: version.id,
    metadata: {
      publicRef: versionRef,
      previous: version.reviewState,
      next: nextState,
      reason: reason.trim(),
      artifacts: version.artifacts.map((row) => ({
        filename: row.filename,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        sha256: row.sha256,
        status: row.status,
      })),
    },
    ipAddress: ipAddress ?? null,
  });
  return { publicRef: versionRef, reviewState: nextState };
}

export async function verifyDeveloperPublisher(
  actorUserId: string,
  slug: string,
  reason: string,
  ipAddress?: string | null,
) {
  const types = await loadActorTypes(actorUserId);
  if (!canStaffVerifyShop(types)) {
    throw new DeveloperError(
      "Publisher verification requires shop-verify staff permission.",
      "FORBIDDEN",
    );
  }
  if (!reason.trim()) throw new DeveloperError("A verification reason is required.", "INVALID");
  const profile = await prisma.developerProfile.findUnique({ where: { slug } });
  if (!profile) throw new DeveloperError("Publisher not found.", "NOT_FOUND");
  await prisma.developerProfile.update({
    where: { id: profile.id },
    data: { verified: true, verifiedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.DEV_PUBLISHER_VERIFIED,
    targetType: "DeveloperProfile",
    targetId: profile.id,
    metadata: { slug, reason: reason.trim(), previous: profile.verified, next: true },
    ipAddress: ipAddress ?? null,
  });
  return { slug, verified: true };
}

export async function suspendDeveloperPublisher(
  actorUserId: string,
  slug: string,
  reason: string,
  ipAddress?: string | null,
) {
  await requireListingStaff(actorUserId);
  if (!reason.trim()) throw new DeveloperError("A suspension reason is required.", "INVALID");
  const profile = await prisma.developerProfile.findUnique({ where: { slug } });
  if (!profile) throw new DeveloperError("Publisher not found.", "NOT_FOUND");
  await prisma.developerProfile.update({
    where: { id: profile.id },
    data: { suspendedAt: new Date() },
  });
  await prisma.developerApplication.updateMany({
    where: { profileId: profile.id },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.DEV_APP_SUSPENDED,
    targetType: "DeveloperProfile",
    targetId: profile.id,
    metadata: { slug, reason: reason.trim(), previous: null, next: "SUSPENDED" },
    ipAddress: ipAddress ?? null,
  });
  return { slug, suspended: true };
}

export async function approveProductionApplication(
  actorUserId: string,
  applicationRef: string,
  reason: string,
  ipAddress?: string | null,
) {
  const types = await loadActorTypes(actorUserId);
  if (!canStaffApproveListing(types)) {
    throw new DeveloperError("Staff approval required.", "FORBIDDEN");
  }
  const app = await prisma.developerApplication.findUnique({
    where: { publicRef: applicationRef },
  });
  if (!app) throw new DeveloperError("Application not found.", "NOT_FOUND");
  await prisma.developerApplication.update({
    where: { id: app.id },
    data: {
      environment: "PRODUCTION",
      productionApprovedAt: new Date(),
      status: "ACTIVE",
    },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditAction.DEV_APP_CREATED,
    targetType: "DeveloperApplication",
    targetId: app.id,
    metadata: {
      publicRef: applicationRef,
      reason: reason.trim() || "production approved",
      previous: app.environment,
      next: "PRODUCTION",
    },
    ipAddress: ipAddress ?? null,
  });
  return { publicRef: applicationRef, environment: "PRODUCTION" as const };
}
