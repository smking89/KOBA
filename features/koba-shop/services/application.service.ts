import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { canManageShop, canVerifyShop } from "@/features/shops/lib/access";
import { KobaShopError } from "@/features/koba-shop/lib/errors";

/** Application-gated selling in the KOBA Shop (client, 2026-08-18) — a
 * second, narrower gate on top of Blue-Badge shop verification
 * (Phase 9). A shop can be Blue-Badge verified and still not be
 * approved to sell here. Review reuses the exact Blue-Badge staff
 * permission (canVerifyShop: SUPERADMIN/ADMIN) and queue pattern,
 * confirmed via AskUserQuestion. */

async function requireShopManager(shopId: string, actorUserId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, ownerUserId: true, members: { select: { userId: true } } },
  });
  if (!shop) throw new KobaShopError("Shop not found.", "NOT_FOUND");
  const memberUserIds = shop.members.map((m: { userId: string }) => m.userId);
  if (!canManageShop({ userId: actorUserId, ownerUserId: shop.ownerUserId, memberUserIds })) {
    throw new KobaShopError("Only shop owners/moderators can do this.", "FORBIDDEN");
  }
  return shop;
}

export async function getShopApplication(shopId: string) {
  return prisma.kobaShopApplication.findUnique({ where: { shopId } });
}

export async function isShopKobaShopApproved(shopId: string): Promise<boolean> {
  const application = await prisma.kobaShopApplication.findUnique({
    where: { shopId },
    select: { status: true },
  });
  return application?.status === "APPROVED";
}

export async function submitKobaShopApplication(shopId: string, actorUserId: string) {
  await requireShopManager(shopId, actorUserId);

  const existing = await prisma.kobaShopApplication.findUnique({ where: { shopId } });
  if (existing && existing.status !== "REJECTED") {
    throw new KobaShopError("An application already exists for this shop.", "CONFLICT");
  }

  const application = existing
    ? await prisma.kobaShopApplication.update({
        where: { shopId },
        data: { status: "PENDING", note: null, reviewedByUserId: null, reviewedAt: null },
      })
    : await prisma.kobaShopApplication.create({ data: { shopId } });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.KOBA_SHOP_APPLICATION_SUBMITTED,
    targetType: "Shop",
    targetId: shopId,
    metadata: { applicationId: application.id },
  });

  return application;
}

export async function listPendingKobaShopApplications(actorUserId: string) {
  const actorTypes = await staffAccountTypes(actorUserId);
  if (!canVerifyShop(actorTypes)) {
    throw new KobaShopError("Staff only.", "FORBIDDEN");
  }
  return prisma.kobaShopApplication.findMany({
    where: { status: "PENDING" },
    include: { shop: { select: { id: true, name: true, slug: true, verificationStatus: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function reviewKobaShopApplication(
  actorUserId: string,
  applicationId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  const actorTypes = await staffAccountTypes(actorUserId);
  if (!canVerifyShop(actorTypes)) {
    throw new KobaShopError("Staff only.", "FORBIDDEN");
  }

  const application = await prisma.kobaShopApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw new KobaShopError("Application not found.", "NOT_FOUND");
  if (application.status !== "PENDING") {
    throw new KobaShopError("This application was already reviewed.", "CONFLICT");
  }

  const updated = await prisma.kobaShopApplication.update({
    where: { id: applicationId },
    data: {
      status: decision,
      note: note ?? null,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorUserId,
    action:
      decision === "APPROVED"
        ? AuditAction.KOBA_SHOP_APPLICATION_APPROVED
        : AuditAction.KOBA_SHOP_APPLICATION_REJECTED,
    targetType: "Shop",
    targetId: application.shopId,
    metadata: { applicationId },
  });

  return updated;
}

async function staffAccountTypes(userId: string): Promise<string[]> {
  const identities = await prisma.kobaIdentity.findMany({
    where: { userId },
    select: { accountType: true },
  });
  return identities.map((row: { accountType: string }) => row.accountType);
}
