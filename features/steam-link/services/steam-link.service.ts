import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";

export class SteamLinkError extends Error {
  constructor(
    message: string,
    readonly code: "ALREADY_LINKED" | "NOT_FOUND" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "SteamLinkError";
  }
}

export async function getSteamLink(userId: string) {
  return prisma.steamAccountLink.findUnique({ where: { userId } });
}

export async function linkSteamAccount(userId: string, steamId64: string, personaName: string | null) {
  const takenByOther = await prisma.steamAccountLink.findFirst({
    where: { steamId64, NOT: { userId } },
  });
  if (takenByOther) {
    throw new SteamLinkError(
      "That Steam account is already linked to a different KOBA profile.",
      "ALREADY_LINKED",
    );
  }

  const link = await prisma.steamAccountLink.upsert({
    where: { userId },
    create: { userId, steamId64, personaName },
    update: { steamId64, personaName, linkedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.STEAM_ACCOUNT_LINKED,
    targetType: "User",
    targetId: userId,
    metadata: { steamId64 },
  });

  return link;
}

export async function unlinkSteamAccount(userId: string) {
  const link = await prisma.steamAccountLink.findUnique({ where: { userId } });
  if (!link) throw new SteamLinkError("No Steam account linked.", "NOT_FOUND");

  await prisma.steamAccountLink.delete({ where: { userId } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.STEAM_ACCOUNT_UNLINKED,
    targetType: "User",
    targetId: userId,
    metadata: { steamId64: link.steamId64 },
  });
}
