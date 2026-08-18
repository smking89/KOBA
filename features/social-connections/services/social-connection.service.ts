import { prisma } from "@/lib/db";
import type { SocialProviderKey } from "@/features/social-connections/lib/providers";
import type { ProviderUser } from "@/features/social-connections/lib/oauth";

export class SocialConnectionError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" = "NOT_FOUND",
  ) {
    super(message);
  }
}

export async function listUserSocialConnections(userId: string) {
  return prisma.userSocialConnection.findMany({ where: { userId } });
}

export async function connectUserSocial(
  userId: string,
  provider: SocialProviderKey,
  providerUser: ProviderUser,
) {
  const takenByOther = await prisma.userSocialConnection.findFirst({
    where: { provider, providerUserId: providerUser.id, NOT: { userId } },
  });
  if (takenByOther) {
    throw new SocialConnectionError(
      "That account is already connected to a different KOBA profile.",
      "CONFLICT",
    );
  }
  return prisma.userSocialConnection.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      providerUserId: providerUser.id,
      providerUsername: providerUser.username,
      profileUrl: providerUser.profileUrl,
    },
    update: {
      providerUserId: providerUser.id,
      providerUsername: providerUser.username,
      profileUrl: providerUser.profileUrl,
      connectedAt: new Date(),
    },
  });
}

export async function disconnectUserSocial(userId: string, provider: SocialProviderKey) {
  await prisma.userSocialConnection.deleteMany({ where: { userId, provider } });
}

export async function listShopSocialConnections(shopId: string) {
  return prisma.shopSocialConnection.findMany({ where: { shopId } });
}

async function requireShopOwnerOrMember(shopId: string, userId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { ownerUserId: true },
  });
  if (!shop) throw new SocialConnectionError("Shop not found.", "NOT_FOUND");
  if (shop.ownerUserId === userId) return;
  const member = await prisma.shopMember.findUnique({
    where: { shopId_userId: { shopId, userId } },
  });
  if (!member || (member.role !== "OWNER" && member.role !== "MODERATOR")) {
    throw new SocialConnectionError("Only shop owners/moderators can manage socials.", "FORBIDDEN");
  }
}

export async function connectShopSocial(
  shopId: string,
  userId: string,
  provider: SocialProviderKey,
  providerUser: ProviderUser,
) {
  await requireShopOwnerOrMember(shopId, userId);
  const takenByOther = await prisma.shopSocialConnection.findFirst({
    where: { provider, providerUserId: providerUser.id, NOT: { shopId } },
  });
  if (takenByOther) {
    throw new SocialConnectionError(
      "That account is already connected to a different KOBA shop.",
      "CONFLICT",
    );
  }
  return prisma.shopSocialConnection.upsert({
    where: { shopId_provider: { shopId, provider } },
    create: {
      shopId,
      provider,
      providerUserId: providerUser.id,
      providerUsername: providerUser.username,
      profileUrl: providerUser.profileUrl,
    },
    update: {
      providerUserId: providerUser.id,
      providerUsername: providerUser.username,
      profileUrl: providerUser.profileUrl,
      connectedAt: new Date(),
    },
  });
}

export async function disconnectShopSocial(shopId: string, userId: string, provider: SocialProviderKey) {
  await requireShopOwnerOrMember(shopId, userId);
  await prisma.shopSocialConnection.deleteMany({ where: { shopId, provider } });
}
