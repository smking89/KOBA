import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";

/**
 * Console platform identity links (client, 2026-08-18: "koba needs to
 * have users connect there gamertag, psn, steam via there dashboard
 * before buying anything" on a game-delivered item). Self-reported, no
 * OAuth — confirmed via AskUserQuestion: KOBAID already proves
 * ownership, these exist purely so delivery (direct RCON today, a
 * Discord bot or the PC Plugin later) knows which in-game account to
 * target. Mirrors features/steam-link's shape exactly, minus the
 * OpenID round-trip Xbox/PSN have no equivalent of.
 */
export class GameIdentityError extends Error {
  constructor(
    message: string,
    readonly code: "ALREADY_LINKED" | "NOT_FOUND" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "GameIdentityError";
  }
}

export async function getXboxLink(userId: string) {
  return prisma.xboxAccountLink.findUnique({ where: { userId } });
}

export async function linkXboxGamertag(userId: string, gamertag: string) {
  const takenByOther = await prisma.xboxAccountLink.findFirst({
    where: { gamertag, NOT: { userId } },
  });
  if (takenByOther) {
    throw new GameIdentityError(
      "That gamertag is already linked to a different KOBA profile.",
      "ALREADY_LINKED",
    );
  }

  const link = await prisma.xboxAccountLink.upsert({
    where: { userId },
    create: { userId, gamertag },
    update: { gamertag, linkedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.XBOX_ACCOUNT_LINKED,
    targetType: "User",
    targetId: userId,
    metadata: { gamertag },
  });

  return link;
}

export async function unlinkXboxGamertag(userId: string) {
  const link = await prisma.xboxAccountLink.findUnique({ where: { userId } });
  if (!link) throw new GameIdentityError("No Xbox gamertag linked.", "NOT_FOUND");

  await prisma.xboxAccountLink.delete({ where: { userId } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.XBOX_ACCOUNT_UNLINKED,
    targetType: "User",
    targetId: userId,
    metadata: { gamertag: link.gamertag },
  });
}

export async function getPlayStationLink(userId: string) {
  return prisma.playStationAccountLink.findUnique({ where: { userId } });
}

export async function linkPlayStationUsername(userId: string, psnUsername: string) {
  const takenByOther = await prisma.playStationAccountLink.findFirst({
    where: { psnUsername, NOT: { userId } },
  });
  if (takenByOther) {
    throw new GameIdentityError(
      "That PSN username is already linked to a different KOBA profile.",
      "ALREADY_LINKED",
    );
  }

  const link = await prisma.playStationAccountLink.upsert({
    where: { userId },
    create: { userId, psnUsername },
    update: { psnUsername, linkedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLAYSTATION_ACCOUNT_LINKED,
    targetType: "User",
    targetId: userId,
    metadata: { psnUsername },
  });

  return link;
}

export async function unlinkPlayStationUsername(userId: string) {
  const link = await prisma.playStationAccountLink.findUnique({ where: { userId } });
  if (!link) throw new GameIdentityError("No PSN username linked.", "NOT_FOUND");

  await prisma.playStationAccountLink.delete({ where: { userId } });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PLAYSTATION_ACCOUNT_UNLINKED,
    targetType: "User",
    targetId: userId,
    metadata: { psnUsername: link.psnUsername },
  });
}

/** Resolves the buyer's already-linked in-game handle for whichever
 * platform(s) a product requires — the gate checkout.service.ts enforces
 * before a game-delivered listing can be purchased at all (client,
 * confirmed via AskUserQuestion: only for listings that actually
 * deliver something in-game, not every purchase platform-wide). PC
 * listings accept a Steam link too, since that's how PC Rust identifies
 * players. */
export async function resolveGameHandleForPlatforms(
  userId: string,
  platforms: readonly string[],
): Promise<string | null> {
  const wantsSteam = platforms.includes("STEAM") || platforms.includes("PC");
  const wantsXbox = platforms.includes("XBOX");
  const wantsPlayStation = platforms.includes("PLAYSTATION");

  if (wantsSteam) {
    const steam = await prisma.steamAccountLink.findUnique({ where: { userId } });
    if (steam) return steam.personaName ?? steam.steamId64;
  }
  if (wantsXbox) {
    const xbox = await getXboxLink(userId);
    if (xbox) return xbox.gamertag;
  }
  if (wantsPlayStation) {
    const psn = await getPlayStationLink(userId);
    if (psn) return psn.psnUsername;
  }
  return null;
}
