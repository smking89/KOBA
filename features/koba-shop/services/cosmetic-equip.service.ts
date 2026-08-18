import { AuditAction, type CosmeticSubType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { isPlusActive } from "@/features/plus/services/plus.service";
import { canManageShop } from "@/features/shops/lib/access";
import { KobaShopError } from "@/features/koba-shop/lib/errors";

/** Anyone can buy a cosmetic; only KOBA Plus members can *equip* one
 * (client, 2026-08-18, confirmed via AskUserQuestion). Equip rows are
 * never deleted just because Plus lapses — visibility is computed at
 * read time from current Plus status, so it reappears automatically the
 * moment Plus resumes rather than needing re-equipping (also
 * confirmed). */

export async function equipCosmetic(userId: string, cosmeticOwnershipId: string) {
  const ownership = await prisma.cosmeticOwnership.findUnique({
    where: { id: cosmeticOwnershipId },
    include: { cosmetic: true },
  });
  if (!ownership || ownership.userId !== userId) {
    throw new KobaShopError("You don't own this cosmetic.", "NOT_OWNED");
  }
  if (ownership.cosmetic.subType === "SHOP_BANNER") {
    throw new KobaShopError("Shop banners equip onto a shop, not a profile.", "FORBIDDEN");
  }
  if (!(await isPlusActive(userId))) {
    throw new KobaShopError("KOBA Plus is required to equip cosmetics.", "REQUIRES_PLUS");
  }

  const equip = await prisma.cosmeticEquip.upsert({
    where: { userId_subType: { userId, subType: ownership.cosmetic.subType } },
    create: { userId, subType: ownership.cosmetic.subType, cosmeticOwnershipId },
    update: { cosmeticOwnershipId, equippedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.COSMETIC_EQUIPPED,
    targetType: "Cosmetic",
    targetId: ownership.cosmeticId,
    metadata: { subType: ownership.cosmetic.subType },
  });

  return equip;
}

export async function unequipCosmetic(userId: string, subType: CosmeticSubType) {
  const existing = await prisma.cosmeticEquip.findUnique({
    where: { userId_subType: { userId, subType } },
  });
  if (!existing) throw new KobaShopError("Nothing equipped in that slot.", "NOT_FOUND");

  await prisma.cosmeticEquip.delete({ where: { id: existing.id } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.COSMETIC_UNEQUIPPED,
    targetType: "Cosmetic",
    targetId: existing.cosmeticOwnershipId,
    metadata: { subType },
  });
}

/** Returns only what should actually render — filters out a user's
 * equip rows if their Plus has lapsed, without touching the rows
 * themselves. */
export async function getVisibleEquippedCosmetics(userId: string) {
  const active = await isPlusActive(userId);
  if (!active) return [];
  return prisma.cosmeticEquip.findMany({
    where: { userId },
    include: { ownership: { include: { cosmetic: true } } },
  });
}

async function requireShopOwner(shopId: string, actorUserId: string) {
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

export async function equipShopBanner(shopId: string, actorUserId: string, cosmeticOwnershipId: string) {
  const shop = await requireShopOwner(shopId, actorUserId);

  const ownership = await prisma.cosmeticOwnership.findUnique({
    where: { id: cosmeticOwnershipId },
    include: { cosmetic: true },
  });
  if (!ownership || ownership.userId !== shop.ownerUserId) {
    throw new KobaShopError("The shop owner doesn't own this cosmetic.", "NOT_OWNED");
  }
  if (ownership.cosmetic.subType !== "SHOP_BANNER") {
    throw new KobaShopError("Only a shop banner cosmetic can equip here.", "FORBIDDEN");
  }
  if (!(await isPlusActive(shop.ownerUserId))) {
    throw new KobaShopError("The shop owner needs KOBA Plus to equip a shop banner.", "REQUIRES_PLUS");
  }

  const equip = await prisma.shopCosmeticEquip.upsert({
    where: { shopId },
    create: { shopId, cosmeticOwnershipId },
    update: { cosmeticOwnershipId, equippedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.COSMETIC_EQUIPPED,
    targetType: "Shop",
    targetId: shopId,
    metadata: { subType: "SHOP_BANNER" },
  });

  return equip;
}

export async function unequipShopBanner(shopId: string, actorUserId: string) {
  const shop = await requireShopOwner(shopId, actorUserId);

  const existing = await prisma.shopCosmeticEquip.findUnique({ where: { shopId } });
  if (!existing) throw new KobaShopError("No shop banner equipped.", "NOT_FOUND");

  await prisma.shopCosmeticEquip.delete({ where: { shopId } });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.COSMETIC_UNEQUIPPED,
    targetType: "Shop",
    targetId: shop.id,
    metadata: { subType: "SHOP_BANNER" },
  });
}

export async function getVisibleShopBanner(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerUserId: true } });
  if (!shop) return null;
  const active = await isPlusActive(shop.ownerUserId);
  if (!active) return null;
  return prisma.shopCosmeticEquip.findUnique({
    where: { shopId },
    include: { ownership: { include: { cosmetic: true } } },
  });
}
