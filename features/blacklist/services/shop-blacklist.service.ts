import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { canManageShop } from "@/features/shops/lib/access";
import type { AddShopBlacklistEntryInput } from "@/features/blacklist/schemas/blacklist.schemas";

export class BlacklistError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "BlacklistError";
  }
}

async function requireShopManager(shopId: string, actorUserId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, ownerUserId: true, members: { select: { userId: true } } },
  });
  if (!shop) throw new BlacklistError("Shop not found.", "NOT_FOUND");
  const memberUserIds = shop.members.map((m: { userId: string }) => m.userId);
  if (!canManageShop({ userId: actorUserId, ownerUserId: shop.ownerUserId, memberUserIds })) {
    throw new BlacklistError("Only shop owners/moderators can manage the blacklist.", "FORBIDDEN");
  }
  return shop;
}

/** Checked at every KOBA-side interaction with this shop today —
 * checkout, freebie claims, follows, reviews. See the schema doc-comment
 * on ShopBlacklistEntry for what's deliberately NOT enforced yet
 * (Discord kick, RCON join-block) and why. */
export async function isUserBlacklistedByShop(shopId: string, userId: string): Promise<boolean> {
  const entry = await prisma.shopBlacklistEntry.findUnique({
    where: { shopId_targetUserId: { shopId, targetUserId: userId } },
    select: { id: true },
  });
  return entry !== null;
}

export async function listShopBlacklist(
  shopId: string,
  actorUserId: string,
  opts?: { query?: string | undefined; hashtag?: string | undefined },
) {
  await requireShopManager(shopId, actorUserId);

  const where: Prisma.ShopBlacklistEntryWhereInput = { shopId };
  if (opts?.hashtag) {
    where.hashtags = { has: opts.hashtag.replace(/^#/, "").toLowerCase() };
  }
  if (opts?.query) {
    const query = opts.query.replace(/^@/, "");
    where.targetUser = {
      OR: [
        { profile: { handle: { contains: query, mode: "insensitive" } } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    };
  }

  return prisma.shopBlacklistEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      targetUser: { select: { id: true, email: true, profile: { select: { handle: true, displayName: true } } } },
      createdBy: { select: { id: true, profile: { select: { handle: true } } } },
    },
  });
}

export async function addShopBlacklistEntry(
  shopId: string,
  actorUserId: string,
  input: AddShopBlacklistEntryInput,
) {
  const shop = await requireShopManager(shopId, actorUserId);
  if (input.targetUserId === shop.ownerUserId) {
    throw new BlacklistError("You cannot blacklist the shop owner.", "INVALID");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true },
  });
  if (!target) throw new BlacklistError("User not found.", "NOT_FOUND");

  const existing = await prisma.shopBlacklistEntry.findUnique({
    where: { shopId_targetUserId: { shopId, targetUserId: input.targetUserId } },
  });
  if (existing) throw new BlacklistError("This user is already blacklisted.", "CONFLICT");

  const entry = await prisma.shopBlacklistEntry.create({
    data: {
      shopId,
      targetUserId: input.targetUserId,
      reason: input.reason,
      hashtags: input.hashtags,
      requestSocialRemoval: input.requestSocialRemoval,
      createdByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.BLACKLIST_ENTRY_ADDED,
    targetType: "User",
    targetId: input.targetUserId,
    metadata: { scope: "shop", shopId, entryId: entry.id, requestSocialRemoval: input.requestSocialRemoval },
  });

  return entry;
}

export async function removeShopBlacklistEntry(shopId: string, actorUserId: string, entryId: string) {
  await requireShopManager(shopId, actorUserId);

  const entry = await prisma.shopBlacklistEntry.findFirst({ where: { id: entryId, shopId } });
  if (!entry) throw new BlacklistError("Blacklist entry not found.", "NOT_FOUND");

  await prisma.shopBlacklistEntry.delete({ where: { id: entryId } });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.BLACKLIST_ENTRY_REMOVED,
    targetType: "User",
    targetId: entry.targetUserId,
    metadata: { scope: "shop", shopId, entryId },
  });
}
