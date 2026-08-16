import { prisma } from "@/lib/db";
import { SocialError } from "@/features/social/lib/errors";
import { canFollowUser } from "@/features/social/lib/rules";
import type { TagPrivacy } from "@/features/social/lib/rules";
import { plusBadgeByIdentityIds } from "@/features/plus/services/plus.service";

const userPublic = {
  id: true,
  name: true,
  image: true,
  createdAt: true,
  profile: {
    select: {
      handle: true,
      displayName: true,
      bio: true,
      tagPrivacy: true,
      activeAccountType: true,
    },
  },
  kobaIdentities: { select: { id: true, code: true, accountType: true } },
} as const;

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null; handle: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Player";
}

async function isBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: a, blockedUserId: b },
        { blockerUserId: b, blockedUserId: a },
      ],
    },
  });
  return Boolean(row);
}

export async function getProfileByHandle(handle: string, viewerUserId?: string | undefined) {
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: { user: { select: userPublic } },
  });
  if (!profile) {
    throw new SocialError("Profile not found.", "NOT_FOUND");
  }
  const userId = profile.userId;
  const activeIdentity =
    profile.user.kobaIdentities.find((row) => row.accountType === profile.activeAccountType) ??
    profile.user.kobaIdentities[0] ??
    null;
  const badges = await plusBadgeByIdentityIds(activeIdentity ? [activeIdentity.id] : []);
  const [followers, following, posts, viewerFollows, blocked] = await Promise.all([
    prisma.userFollow.count({ where: { followingUserId: userId } }),
    prisma.userFollow.count({ where: { followerUserId: userId } }),
    prisma.post.count({
      where: { authorUserId: userId, moderationStatus: "LIVE", visibility: "PUBLIC" },
    }),
    viewerUserId
      ? prisma.userFollow.findUnique({
          where: {
            followerUserId_followingUserId: {
              followerUserId: viewerUserId,
              followingUserId: userId,
            },
          },
        })
      : null,
    viewerUserId ? isBlocked(viewerUserId, userId) : false,
  ]);

  return {
    handle: profile.handle,
    name: displayName(profile.user),
    bio: profile.bio,
    image: profile.user.image,
    createdAt: profile.user.createdAt.toISOString(),
    accountType: profile.activeAccountType,
    identities: profile.user.kobaIdentities.map((row) => ({
      accountType: row.accountType,
      code: row.code,
    })),
    kobaId: activeIdentity?.code ?? null,
    plusBadge: activeIdentity ? Boolean(badges.get(activeIdentity.id)) : false,
    tagPrivacy: profile.tagPrivacy,
    followers,
    following,
    posts,
    isSelf: viewerUserId === userId,
    followingThem: Boolean(viewerFollows),
    blocked,
  };
}

export async function toggleFollow(actorUserId: string, handle: string) {
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: handle.toLowerCase() },
  });
  if (!profile) {
    throw new SocialError("Profile not found.", "NOT_FOUND");
  }
  const blocked = await isBlocked(actorUserId, profile.userId);
  if (!canFollowUser({ actorUserId, targetUserId: profile.userId, blocked })) {
    throw new SocialError("You cannot follow this account.", blocked ? "BLOCKED" : "INVALID");
  }
  const existing = await prisma.userFollow.findUnique({
    where: {
      followerUserId_followingUserId: {
        followerUserId: actorUserId,
        followingUserId: profile.userId,
      },
    },
  });
  if (existing) {
    await prisma.userFollow.delete({
      where: {
        followerUserId_followingUserId: {
          followerUserId: actorUserId,
          followingUserId: profile.userId,
        },
      },
    });
    return { following: false };
  }
  await prisma.userFollow.create({
    data: { followerUserId: actorUserId, followingUserId: profile.userId },
  });
  return { following: true };
}

export async function toggleBlock(actorUserId: string, handle: string) {
  const profile = await prisma.accountProfile.findUnique({
    where: { handle: handle.toLowerCase() },
  });
  if (!profile) {
    throw new SocialError("Profile not found.", "NOT_FOUND");
  }
  if (profile.userId === actorUserId) {
    throw new SocialError("You cannot block yourself.", "INVALID");
  }
  const existing = await prisma.userBlock.findUnique({
    where: {
      blockerUserId_blockedUserId: { blockerUserId: actorUserId, blockedUserId: profile.userId },
    },
  });
  if (existing) {
    await prisma.userBlock.delete({
      where: {
        blockerUserId_blockedUserId: { blockerUserId: actorUserId, blockedUserId: profile.userId },
      },
    });
    return { blocked: false };
  }
  await prisma.$transaction([
    prisma.userBlock.create({
      data: { blockerUserId: actorUserId, blockedUserId: profile.userId },
    }),
    prisma.userFollow.deleteMany({
      where: {
        OR: [
          { followerUserId: actorUserId, followingUserId: profile.userId },
          { followerUserId: profile.userId, followingUserId: actorUserId },
        ],
      },
    }),
  ]);
  return { blocked: true };
}

export async function updateSocialSettings(
  userId: string,
  input: { tagPrivacy: TagPrivacy; bio?: string | undefined },
) {
  await prisma.accountProfile.update({
    where: { userId },
    data: {
      tagPrivacy: input.tagPrivacy,
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
    },
  });
  return { ok: true };
}

export async function setGroupTagging(userId: string, slug: string, allowed: boolean) {
  const group = await prisma.group.findUnique({ where: { slug } });
  if (!group) {
    throw new SocialError("Group not found.", "NOT_FOUND");
  }
  if (group.ownerUserId !== userId) {
    throw new SocialError("Only the group owner can change tagging.", "FORBIDDEN");
  }
  await prisma.group.update({ where: { id: group.id }, data: { taggingAllowed: allowed } });
  return { taggingAllowed: allowed };
}

export async function setShopTagging(userId: string, allowed: boolean) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new SocialError("Create a shop first.", "NOT_FOUND");
  }
  await prisma.shop.update({ where: { id: shop.id }, data: { taggingAllowed: allowed } });
  return { taggingAllowed: allowed };
}
