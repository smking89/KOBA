import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  canStaffApproveListing,
  canStaffModerateContent,
  canStaffRefund,
  canStaffVerifyShop,
  isAnyStaff,
} from "@/features/admin/lib/access";
import { AdminError } from "@/features/admin/lib/errors";
import { hidePost } from "@/features/social/services/post.service";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";

export async function requireAnyStaff(userId: string, opts?: { stepUp?: boolean }) {
  const assurance = await assertStaffAal2(userId, opts);
  if (!isAnyStaff(assurance.types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }
  return assurance.types;
}

export async function getAdminOverview(actorUserId: string) {
  await requireAnyStaff(actorUserId);

  const [
    pendingProducts,
    pendingShops,
    openReports,
    paidOrders,
    pendingAidenAssets,
    pendingDevProducts,
    recentAudit,
  ] = await Promise.all([
    prisma.product.count({ where: { moderationStatus: "PENDING" } }),
    prisma.shop.count({ where: { verificationStatus: "PENDING" } }),
    prisma.contentReport.count({ where: { status: "OPEN" } }),
    prisma.order.count({ where: { status: { in: ["PAID", "FULFILLED"] } } }),
    prisma.aidenAsset.count({ where: { moderation: "PENDING_REVIEW" } }),
    prisma.devProduct.count({
      where: { reviewState: { in: ["SUBMITTED", "IN_REVIEW", "SECURITY_REVIEW"] } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    }),
  ]);

  return {
    counts: {
      pendingProducts,
      pendingShops,
      openReports,
      refundableOrders: paidOrders,
      pendingAidenAssets,
      pendingDevProducts,
    },
    recentAudit,
  };
}

export async function listPendingProducts(actorUserId: string) {
  const types = await requireAnyStaff(actorUserId);
  if (!canStaffApproveListing(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const products = await prisma.product.findMany({
    where: { moderationStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: {
      shop: { select: { slug: true, name: true } },
      game: { select: { slug: true, name: true } },
      category: { select: { slug: true, name: true } },
      seller: { select: { email: true, profile: { select: { handle: true } } } },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    title: product.title,
    listingType: product.listingType,
    priceCents: product.priceCents,
    updatedAt: product.updatedAt.toISOString(),
    shopSlug: product.shop?.slug ?? null,
    shopName: product.shop?.name ?? null,
    game: product.game.name,
    category: product.category.name,
    sellerHandle: product.seller.profile?.handle ?? null,
    sellerEmail: product.seller.email,
  }));
}

export async function listPendingServers(actorUserId: string) {
  await requireAnyStaff(actorUserId);
  const { listPendingServers: list } = await import("@/features/servers/services/server.service");
  return list(actorUserId);
}

export async function listPendingShops(actorUserId: string) {
  const types = await requireAnyStaff(actorUserId);
  if (!canStaffVerifyShop(types)) {
    throw new AdminError("Only Admin or Superadmin can review shops.", "FORBIDDEN");
  }

  const shops = await prisma.shop.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: {
      owner: { select: { email: true, profile: { select: { handle: true } } } },
      _count: { select: { products: true } },
    },
  });

  return shops.map((shop) => ({
    slug: shop.slug,
    name: shop.name,
    bio: shop.bio,
    updatedAt: shop.updatedAt.toISOString(),
    productCount: shop._count.products,
    ownerHandle: shop.owner.profile?.handle ?? null,
    ownerEmail: shop.owner.email,
  }));
}

export async function listOpenReports(actorUserId: string) {
  const types = await requireAnyStaff(actorUserId);
  if (!canStaffModerateContent(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const reports = await prisma.contentReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      reporter: { select: { email: true, profile: { select: { handle: true } } } },
    },
  });

  return reports.map((report) => ({
    publicRef: report.publicRef,
    targetType: report.targetType,
    targetRef: report.targetRef,
    reason: report.reason,
    createdAt: report.createdAt.toISOString(),
    reporterHandle: report.reporter.profile?.handle ?? null,
    reporterEmail: report.reporter.email,
  }));
}

export async function resolveReport(
  actorUserId: string,
  publicRef: string,
  input: { status: "REVIEWED" | "DISMISSED"; hidePost?: boolean | undefined },
  ipAddress?: string | null,
) {
  const types = await requireAnyStaff(actorUserId, { stepUp: Boolean(input.hidePost) });
  if (!canStaffModerateContent(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const report = await prisma.contentReport.findUnique({ where: { publicRef } });
  if (!report) {
    throw new AdminError("Report not found.", "NOT_FOUND");
  }
  if (report.status !== "OPEN") {
    throw new AdminError("Report is already resolved.", "CONFLICT");
  }

  if (input.hidePost && report.targetType === "POST") {
    await hidePost(actorUserId, report.targetRef);
  }

  const updated = await prisma.contentReport.update({
    where: { id: report.id },
    data: { status: input.status },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.REPORT_RESOLVED,
    targetType: "ContentReport",
    targetId: report.id,
    metadata: {
      publicRef,
      status: input.status,
      hidePost: Boolean(input.hidePost),
      targetType: report.targetType,
      targetRef: report.targetRef,
    },
    ipAddress: ipAddress ?? null,
  });

  return { publicRef: updated.publicRef, status: updated.status };
}

export async function staffRejectProduct(
  actorUserId: string,
  slug: string,
  note?: string,
  ipAddress?: string | null,
) {
  const types = await requireAnyStaff(actorUserId, { stepUp: true });
  if (!canStaffApproveListing(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) {
    throw new AdminError("Product not found.", "NOT_FOUND");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      moderationStatus: "REJECTED",
      publishedAt: null,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.PRODUCT_REJECTED,
    targetType: "Product",
    targetId: product.id,
    metadata: { slug, note: note ?? null },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function listPendingAidenAssets(actorUserId: string) {
  const types = await requireAnyStaff(actorUserId);
  if (!canStaffModerateContent(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const assets = await prisma.aidenAsset.findMany({
    where: { moderation: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: {
      user: { select: { email: true, profile: { select: { handle: true } } } },
    },
  });

  return assets.map((asset) => ({
    publicRef: asset.publicRef,
    title: asset.title,
    game: asset.game,
    assetType: asset.assetType,
    technicalStatus: asset.technicalStatus,
    provider: asset.provider,
    model: asset.model,
    modelVersion: asset.modelVersion,
    createdAt: asset.createdAt.toISOString(),
    ownerHandle: asset.user.profile?.handle ?? null,
    ownerEmail: asset.user.email,
  }));
}

export async function staffReviewAidenAsset(
  actorUserId: string,
  publicRef: string,
  action: "approve" | "reject",
  ipAddress?: string | null,
) {
  const types = await requireAnyStaff(actorUserId, { stepUp: action === "reject" });
  if (!canStaffModerateContent(types)) {
    throw new AdminError("Staff only.", "FORBIDDEN");
  }

  const asset = await prisma.aidenAsset.findUnique({ where: { publicRef } });
  if (!asset) {
    throw new AdminError("Aiden asset not found.", "NOT_FOUND");
  }
  if (asset.moderation !== "PENDING_REVIEW") {
    throw new AdminError("Asset is not awaiting review.", "CONFLICT");
  }

  const updated = await prisma.aidenAsset.update({
    where: { id: asset.id },
    data: {
      moderation: action === "approve" ? "APPROVED" : "REJECTED",
      technicalStatus: action === "approve" ? "APPROVED_FOR_MARKETPLACE" : asset.technicalStatus,
    },
  });

  await writeAuditLog({
    actorUserId,
    action:
      action === "approve" ? AuditAction.AIDEN_ASSET_APPROVED : AuditAction.AIDEN_ASSET_REJECTED,
    targetType: "AidenAsset",
    targetId: asset.id,
    metadata: {
      publicRef,
      listingCreated: false,
      generatedByAiden: true,
      provider: asset.provider,
      model: asset.model,
    },
    ipAddress: ipAddress ?? null,
  });

  return {
    publicRef: updated.publicRef,
    moderation: updated.moderation,
    technicalStatus: updated.technicalStatus,
  };
}

export async function assertCanStaffRefund(actorUserId: string) {
  const types = await requireAnyStaff(actorUserId, { stepUp: true });
  if (!canStaffRefund(types)) {
    throw new AdminError("Only Admin or Superadmin can refund.", "FORBIDDEN");
  }
  return types;
}
