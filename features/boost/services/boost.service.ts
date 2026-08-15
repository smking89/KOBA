import { randomUUID } from "node:crypto";
import { AuditAction, type BoostTargetKind } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { canManageShop } from "@/features/shops/lib/access";
import { GROUP_ROLE_RANK, groupRoleRank } from "@/features/groups/lib/access";
import { BOOST_COIN_COST, BOOST_DURATION_MS, BOOST_MULTIPLIER } from "@/features/boost/lib/pricing";
import { WalletError } from "@/features/wallet/lib/errors";
import { captureReservation, reserveCoins } from "@/features/wallet/services/ledger.service";

export class BoostError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "INSUFFICIENT",
  ) {
    super(message);
    this.name = "BoostError";
  }
}

/**
 * Whether userId may apply/manage a boost against this target. Follows
 * each entity's existing "who can manage this" rule rather than
 * inventing a new one: shop membership for PRODUCT/SHOP (a product's
 * boostability is gated by its shop, same as everything else about a
 * product), group ADMIN+ for GROUP (matches canModerateMembership's
 * bar elsewhere in features/groups).
 */
async function assertCanManageBoostTarget(
  userId: string,
  targetType: BoostTargetKind,
  targetId: string,
): Promise<void> {
  if (targetType === "PRODUCT") {
    const product = await prisma.product.findUnique({
      where: { id: targetId },
      include: { shop: { include: { members: { select: { userId: true } } } } },
    });
    if (!product || !product.shop) {
      throw new BoostError("Product not found.", "NOT_FOUND");
    }
    const allowed = canManageShop({
      userId,
      ownerUserId: product.shop.ownerUserId,
      memberUserIds: product.shop.members.map((m) => m.userId),
    });
    if (!allowed) {
      throw new BoostError("You cannot boost a product you don't manage.", "FORBIDDEN");
    }
    return;
  }

  if (targetType === "SHOP") {
    const shop = await prisma.shop.findUnique({
      where: { id: targetId },
      include: { members: { select: { userId: true } } },
    });
    if (!shop) {
      throw new BoostError("Shop not found.", "NOT_FOUND");
    }
    const allowed = canManageShop({
      userId,
      ownerUserId: shop.ownerUserId,
      memberUserIds: shop.members.map((m) => m.userId),
    });
    if (!allowed) {
      throw new BoostError("You cannot boost a shop you don't manage.", "FORBIDDEN");
    }
    return;
  }

  // GROUP
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: targetId, userId } },
  });
  if (groupRoleRank(membership?.role ?? null) < GROUP_ROLE_RANK.ADMIN) {
    throw new BoostError("You cannot boost a group you don't administer.", "FORBIDDEN");
  }
}

export async function purchaseBoost(
  userId: string,
  idempotencyKey: string,
  ipAddress?: string | null,
) {
  let reservation: Awaited<ReturnType<typeof reserveCoins>>;
  try {
    reservation = await reserveCoins({
      userId,
      amount: BOOST_COIN_COST,
      purpose: "Boost purchase",
      idempotencyKey: `boost-reserve:${idempotencyKey}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT") {
      throw new BoostError("Insufficient KOBA Coins to buy a Boost.", "INSUFFICIENT");
    }
    throw error;
  }

  await captureReservation({
    userId,
    reservationPublicRef: reservation.publicRef,
    idempotencyKey: `boost-capture:${idempotencyKey}`,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });

  const boost = await prisma.boost.create({
    data: {
      ownerUserId: userId,
      purchaseCoinCost: BOOST_COIN_COST,
      idempotencyKey,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.BOOST_PURCHASED,
    targetType: "Boost",
    targetId: boost.id,
    metadata: { coinCost: BOOST_COIN_COST },
    ipAddress: ipAddress ?? null,
  });

  return boost;
}

export async function giftBoost(
  userId: string,
  boostId: string,
  recipientUserId: string,
  ipAddress?: string | null,
) {
  if (recipientUserId === userId) {
    throw new BoostError("You already own this Boost.", "INVALID");
  }

  const boost = await prisma.boost.findUnique({ where: { id: boostId } });
  if (!boost) {
    throw new BoostError("Boost not found.", "NOT_FOUND");
  }
  if (boost.ownerUserId !== userId) {
    throw new BoostError("You don't own this Boost.", "FORBIDDEN");
  }
  if (boost.status !== "UNUSED") {
    throw new BoostError("Only an unused Boost can be gifted.", "INVALID");
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientUserId } });
  if (!recipient) {
    throw new BoostError("Recipient account not found.", "NOT_FOUND");
  }

  const updated = await prisma.boost.update({
    where: { id: boostId },
    data: {
      ownerUserId: recipientUserId,
      giftedFromUserId: userId,
      giftedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.BOOST_GIFTED,
    targetType: "Boost",
    targetId: boostId,
    metadata: { recipientUserId },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function applyBoost(
  userId: string,
  boostId: string,
  targetType: BoostTargetKind,
  targetId: string,
  ipAddress?: string | null,
) {
  const boost = await prisma.boost.findUnique({ where: { id: boostId } });
  if (!boost) {
    throw new BoostError("Boost not found.", "NOT_FOUND");
  }
  if (boost.ownerUserId !== userId) {
    throw new BoostError("You don't own this Boost.", "FORBIDDEN");
  }
  if (boost.status !== "UNUSED") {
    throw new BoostError("This Boost has already been used.", "INVALID");
  }

  await assertCanManageBoostTarget(userId, targetType, targetId);

  const appliedAt = new Date();
  const expiresAt = new Date(appliedAt.getTime() + BOOST_DURATION_MS);

  const updated = await prisma.boost.update({
    where: { id: boostId },
    data: { status: "APPLIED", targetType, targetId, appliedAt, expiresAt },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.BOOST_APPLIED,
    targetType: "Boost",
    targetId: boostId,
    metadata: { boostedTargetType: targetType, boostedTargetId: targetId, expiresAt },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function listMyBoosts(userId: string) {
  return prisma.boost.findMany({
    where: { ownerUserId: userId },
    orderBy: { purchasedAt: "desc" },
  });
}

/** Active target ids for a given kind — used to sort/badge listings
 * without an N+1 lookup per row (see marketplace query wiring). */
export async function activeBoostedTargetIds(targetType: BoostTargetKind): Promise<Set<string>> {
  const rows = await prisma.boost.findMany({
    where: { status: "APPLIED", targetType, expiresAt: { gt: new Date() } },
    select: { targetId: true },
  });
  return new Set(rows.map((row) => row.targetId).filter((id): id is string => id !== null));
}

export function newBoostIdempotencyKey(): string {
  return randomUUID();
}

export { BOOST_MULTIPLIER };
