import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { canManagePlatformBlacklist } from "@/features/blacklist/lib/access";
import type { AddPlatformBlacklistEntryInput } from "@/features/blacklist/schemas/blacklist.schemas";

export class PlatformBlacklistError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "PlatformBlacklistError";
  }
}

async function requireSuperadmin(actorUserId: string) {
  const identities = await prisma.kobaIdentity.findMany({
    where: { userId: actorUserId },
    select: { accountType: true },
  });
  const types = identities.map((row: { accountType: string }) => row.accountType);
  if (!canManagePlatformBlacklist(types)) {
    throw new PlatformBlacklistError("Superadmin only.", "FORBIDDEN");
  }
}

/** The single choke point every login path funnels through
 * (lib/auth/credentials-provider.ts's sessionUserFromId) — a full
 * account lockout, confirmed via AskUserQuestion. */
export async function isUserPlatformBanned(userId: string): Promise<boolean> {
  const entry = await prisma.platformBlacklistEntry.findUnique({
    where: { targetUserId: userId },
    select: { id: true },
  });
  return entry !== null;
}

export async function isShopPlatformBanned(shopId: string): Promise<boolean> {
  const entry = await prisma.platformBlacklistEntry.findUnique({
    where: { targetShopId: shopId },
    select: { id: true },
  });
  return entry !== null;
}

export async function listPlatformBlacklist(
  actorUserId: string,
  opts?: { query?: string | undefined; hashtag?: string | undefined; targetType?: "USER" | "SHOP" | undefined },
) {
  await requireSuperadmin(actorUserId);

  const where: Prisma.PlatformBlacklistEntryWhereInput = {};
  if (opts?.targetType) where.targetType = opts.targetType;
  if (opts?.hashtag) where.hashtags = { has: opts.hashtag.replace(/^#/, "").toLowerCase() };
  if (opts?.query) {
    const query = opts.query.replace(/^@/, "");
    where.OR = [
      { targetUser: { is: { profile: { is: { handle: { contains: query, mode: "insensitive" } } } } } },
      { targetUser: { is: { email: { contains: query, mode: "insensitive" } } } },
      { targetShop: { is: { name: { contains: query, mode: "insensitive" } } } },
      { targetShop: { is: { slug: { contains: query, mode: "insensitive" } } } },
    ];
  }

  return prisma.platformBlacklistEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      targetUser: { select: { id: true, email: true, profile: { select: { handle: true, displayName: true } } } },
      targetShop: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, profile: { select: { handle: true } } } },
    },
  });
}

export async function addPlatformBlacklistEntry(
  actorUserId: string,
  input: AddPlatformBlacklistEntryInput,
) {
  await requireSuperadmin(actorUserId);

  if (input.targetType === "USER") {
    if (input.targetId === actorUserId) {
      throw new PlatformBlacklistError("You cannot ban yourself.", "INVALID");
    }
    const target = await prisma.user.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!target) throw new PlatformBlacklistError("User not found.", "NOT_FOUND");
    const existing = await prisma.platformBlacklistEntry.findUnique({
      where: { targetUserId: input.targetId },
    });
    if (existing) throw new PlatformBlacklistError("This user is already banned.", "CONFLICT");
  } else {
    const target = await prisma.shop.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!target) throw new PlatformBlacklistError("Shop not found.", "NOT_FOUND");
    const existing = await prisma.platformBlacklistEntry.findUnique({
      where: { targetShopId: input.targetId },
    });
    if (existing) throw new PlatformBlacklistError("This shop is already banned.", "CONFLICT");
  }

  const entry = await prisma.platformBlacklistEntry.create({
    data: {
      targetType: input.targetType,
      targetUserId: input.targetType === "USER" ? input.targetId : null,
      targetShopId: input.targetType === "SHOP" ? input.targetId : null,
      reason: input.reason,
      hashtags: input.hashtags,
      requestSocialRemoval: input.requestSocialRemoval,
      createdByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.PLATFORM_BAN_ISSUED,
    targetType: input.targetType === "USER" ? "User" : "Shop",
    targetId: input.targetId,
    metadata: { entryId: entry.id, requestSocialRemoval: input.requestSocialRemoval },
  });

  return entry;
}

export async function removePlatformBlacklistEntry(actorUserId: string, entryId: string) {
  await requireSuperadmin(actorUserId);

  const entry = await prisma.platformBlacklistEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new PlatformBlacklistError("Ban entry not found.", "NOT_FOUND");

  await prisma.platformBlacklistEntry.delete({ where: { id: entryId } });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.PLATFORM_BAN_LIFTED,
    targetType: entry.targetType === "USER" ? "User" : "Shop",
    targetId: entry.targetUserId ?? entry.targetShopId ?? entry.id,
    metadata: { entryId },
  });
}
