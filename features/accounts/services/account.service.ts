import type { KobaAccountType } from "@/features/koba-id/lib/format";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { mintPublicKobaId, KobaIdError } from "@/features/koba-id/services/mint.service";
import { isPublicAccountType } from "@/features/koba-id/lib/format";

export type AccountSnapshot = {
  userId: string;
  displayName: string | null;
  activeAccountType: KobaAccountType;
  kobaId: string | null;
  kobaIdRevealed: boolean;
  identities: { accountType: KobaAccountType; code: string }[];
};

export async function getAccountSnapshot(userId: string): Promise<AccountSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      kobaIdentities: {
        select: { accountType: true, code: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return null;
  }

  const activeAccountType = user.profile?.activeAccountType ?? "PLAYER";
  const activeIdentity =
    user.kobaIdentities.find((identity) => identity.accountType === activeAccountType) ??
    user.kobaIdentities[0] ??
    null;

  return {
    userId: user.id,
    displayName: user.profile?.displayName ?? user.name,
    activeAccountType,
    kobaId: activeIdentity?.code ?? null,
    kobaIdRevealed: Boolean(user.profile?.kobaIdRevealedAt),
    identities: user.kobaIdentities.map((identity) => ({
      accountType: identity.accountType,
      code: identity.code,
    })),
  };
}

export async function switchActiveAccount(
  userId: string,
  accountType: KobaAccountType,
  ipAddress?: string | null,
) {
  if (!isPublicAccountType(accountType)) {
    throw new KobaIdError(
      "Staff modes cannot be selected from public account switching.",
      "STAFF_NOT_PUBLIC",
    );
  }

  const identity = await prisma.kobaIdentity.findUnique({
    where: { userId_accountType: { userId, accountType } },
  });

  if (!identity) {
    throw new KobaIdError("Mint this account type before switching to it.", "IDENTITY_MISSING");
  }

  await prisma.accountProfile.update({
    where: { userId },
    data: { activeAccountType: accountType },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.ACCOUNT_SWITCHED,
    targetType: "AccountProfile",
    targetId: userId,
    metadata: { accountType, code: identity.code },
    ipAddress: ipAddress ?? null,
  });

  return getAccountSnapshot(userId);
}

export async function addPublicAccountType(
  userId: string,
  accountType: KobaAccountType,
  ipAddress?: string | null,
) {
  const identity = await mintPublicKobaId(userId, accountType, ipAddress);

  await prisma.accountProfile.update({
    where: { userId },
    data: { activeAccountType: accountType, kobaIdRevealedAt: null },
  });

  return identity;
}

export async function markKobaIdRevealed(userId: string) {
  await prisma.accountProfile.update({
    where: { userId },
    data: { kobaIdRevealedAt: new Date() },
  });

  return getAccountSnapshot(userId);
}
