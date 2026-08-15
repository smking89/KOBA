import { prisma } from "@/lib/db";
import { AidenError } from "@/features/aiden/lib/errors";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

export type ActiveAidenIdentity = {
  userId: string;
  identityId: string;
  accountType: KobaAccountType;
  code: string;
};

export async function resolveActiveAidenIdentity(userId: string): Promise<ActiveAidenIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      profile: { select: { activeAccountType: true } },
      kobaIdentities: {
        select: { id: true, accountType: true, code: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) {
    throw new AidenError("Account not found.", "NOT_FOUND");
  }
  const activeAccountType = user.profile?.activeAccountType ?? "PLAYER";
  const identity =
    user.kobaIdentities.find((row) => row.accountType === activeAccountType) ??
    user.kobaIdentities[0];
  if (!identity) {
    throw new AidenError("Mint a KOBAID before using Aiden.", "INVALID");
  }
  return {
    userId: user.id,
    identityId: identity.id,
    accountType: identity.accountType,
    code: identity.code,
  };
}
