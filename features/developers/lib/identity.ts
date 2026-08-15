import { prisma } from "@/lib/db";
import { DeveloperError } from "@/features/developers/lib/errors";
import type { DeveloperMemberRole } from "@/lib/generated/prisma/client";

export async function resolveDeveloperIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      profile: { select: { activeAccountType: true } },
      kobaIdentities: {
        select: { id: true, accountType: true, code: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) throw new DeveloperError("Account not found.", "NOT_FOUND");
  const activeAccountType = user.profile?.activeAccountType ?? "PLAYER";
  const identity =
    user.kobaIdentities.find((row) => row.accountType === activeAccountType) ??
    user.kobaIdentities[0];
  if (!identity) {
    throw new DeveloperError("Mint a KOBAID before using the developer portal.", "INVALID");
  }
  if (
    identity.accountType !== "PLAYER" &&
    identity.accountType !== "BUSINESS" &&
    identity.accountType !== "INFLUENCER"
  ) {
    throw new DeveloperError("Staff KOBAIDs cannot publish as developers.", "FORBIDDEN");
  }
  return { userId: user.id, email: user.email, identity };
}

export async function requireMembership(userId: string, profileId: string) {
  const member = await prisma.developerMember.findUnique({
    where: { profileId_userId: { profileId, userId } },
    include: { profile: true },
  });
  if (!member) throw new DeveloperError("Developer profile not found.", "NOT_FOUND");
  if (member.profile.suspendedAt) {
    throw new DeveloperError("This publisher is suspended.", "FORBIDDEN");
  }
  return member;
}

export async function requireRole(
  userId: string,
  profileId: string,
  allowed: readonly DeveloperMemberRole[],
) {
  const member = await requireMembership(userId, profileId);
  if (!allowed.includes(member.role)) {
    throw new DeveloperError("This role cannot perform that action.", "FORBIDDEN");
  }
  return member;
}
