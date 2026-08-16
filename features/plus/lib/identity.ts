import { prisma } from "@/lib/db";
import { PlusError } from "@/features/plus/lib/errors";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

export type ActivePlusIdentity = {
  userId: string;
  identityId: string;
  accountType: KobaAccountType;
  code: string;
  email: string | null;
  stripeCustomerId: string | null;
};

export async function resolveActivePlusIdentity(userId: string): Promise<ActivePlusIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      profile: { select: { activeAccountType: true } },
      kobaIdentities: {
        select: { id: true, accountType: true, code: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new PlusError("Account not found.", "NOT_FOUND");
  }

  const activeAccountType = user.profile?.activeAccountType ?? "PLAYER";
  const identity =
    user.kobaIdentities.find((row) => row.accountType === activeAccountType) ??
    user.kobaIdentities[0];

  if (!identity) {
    throw new PlusError("Mint a KOBAID before subscribing to Plus.", "INVALID");
  }

  return {
    userId: user.id,
    identityId: identity.id,
    accountType: identity.accountType,
    code: identity.code,
    email: user.email,
    stripeCustomerId: user.stripeCustomerId,
  };
}
