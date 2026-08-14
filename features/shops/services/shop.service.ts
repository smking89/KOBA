import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  canCreateShop,
  canFollowOrReviewShop,
  canManageShop,
  canVerifyShop,
  slugify,
} from "@/features/shops/lib/access";
import type { createShopSchema } from "@/features/shops/schemas/shop.schemas";
import type { z } from "zod";

export class ShopError extends Error {
  constructor(
    message: string,
    readonly code:
      "FORBIDDEN" | "NOT_FOUND" | "ALREADY_EXISTS" | "SELF_ACTION" | "UNVERIFIED_BUSINESS",
  ) {
    super(message);
    this.name = "ShopError";
  }
}

async function loadActor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      kobaIdentities: { select: { accountType: true } },
      ownedShop: true,
      shopMemberships: { select: { shopId: true, role: true } },
    },
  });
  if (!user) {
    throw new ShopError("Account not found.", "NOT_FOUND");
  }
  return user;
}

function hasBusinessIdentity(accountTypes: readonly string[]): boolean {
  return accountTypes.includes("BUSINESS");
}

export async function createShop(
  userId: string,
  input: z.infer<typeof createShopSchema>,
  ipAddress?: string | null,
) {
  const actor = await loadActor(userId);
  const accountTypes = actor.kobaIdentities.map((row) => row.accountType);

  if (
    !canCreateShop({
      hasBusinessIdentity: hasBusinessIdentity(accountTypes),
      alreadyOwnsShop: Boolean(actor.ownedShop),
    })
  ) {
    throw new ShopError(
      "Only a Business KOBAID can open a shop, and each account may own one.",
      "FORBIDDEN",
    );
  }

  let slug = slugify(input.name);
  const clash = await prisma.shop.findUnique({ where: { slug } });
  if (clash) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }

  const shop = await prisma.shop.create({
    data: {
      slug,
      name: input.name,
      bio: input.bio,
      ownerUserId: userId,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SHOP_CREATED,
    targetType: "Shop",
    targetId: shop.id,
    metadata: { slug: shop.slug },
    ipAddress: ipAddress ?? null,
  });

  return shop;
}

export async function getOwnedShop(userId: string) {
  return prisma.shop.findUnique({
    where: { ownerUserId: userId },
    include: {
      _count: { select: { follows: true, reviews: true, products: true, orders: true } },
    },
  });
}

export async function getPublicShop(slug: string, viewerUserId?: string | null) {
  const shop = await prisma.shop.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true } },
          kobaIdentities: { select: { accountType: true, code: true } },
        },
      },
      members: {
        include: {
          user: {
            select: {
              name: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          author: { select: { name: true, profile: { select: { displayName: true } } } },
        },
      },
      _count: { select: { follows: true, reviews: true, products: true } },
    },
  });

  if (!shop) {
    return null;
  }

  const kobaId =
    shop.owner.kobaIdentities.find((row) => row.accountType === "BUSINESS")?.code ??
    shop.owner.kobaIdentities[0]?.code ??
    null;

  let following = false;
  if (viewerUserId) {
    const follow = await prisma.shopFollow.findUnique({
      where: { shopId_userId: { shopId: shop.id, userId: viewerUserId } },
    });
    following = Boolean(follow);
  }

  const ratingSum = shop.reviews.reduce((sum, review) => sum + review.rating, 0);
  const ratingAvg = shop.reviews.length > 0 ? ratingSum / shop.reviews.length : null;

  return {
    slug: shop.slug,
    name: shop.name,
    bio: shop.bio,
    verificationStatus: shop.verificationStatus,
    kobaId,
    followerCount: shop._count.follows,
    reviewCount: shop._count.reviews,
    productCount: shop._count.products,
    ratingAvg,
    following,
    isOwner: viewerUserId === shop.owner.id,
    members: shop.members.map((member) => ({
      role: member.role,
      name: member.user.profile?.displayName ?? member.user.name ?? "Member",
    })),
    reviews: shop.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      author: review.author.profile?.displayName ?? review.author.name ?? "Player",
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function assertCanManageShop(userId: string, shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { members: { select: { userId: true } } },
  });
  if (!shop) {
    throw new ShopError("Shop not found.", "NOT_FOUND");
  }
  if (
    !canManageShop({
      userId,
      ownerUserId: shop.ownerUserId,
      memberUserIds: shop.members.map((row) => row.userId),
    })
  ) {
    throw new ShopError("You cannot manage this shop.", "FORBIDDEN");
  }
  return shop;
}

export async function toggleShopFollow(userId: string, slug: string) {
  const shop = await prisma.shop.findUnique({ where: { slug } });
  if (!shop) {
    throw new ShopError("Shop not found.", "NOT_FOUND");
  }
  if (!canFollowOrReviewShop({ userId, ownerUserId: shop.ownerUserId })) {
    throw new ShopError("You cannot follow your own shop.", "SELF_ACTION");
  }

  const existing = await prisma.shopFollow.findUnique({
    where: { shopId_userId: { shopId: shop.id, userId } },
  });
  if (existing) {
    await prisma.shopFollow.delete({
      where: { shopId_userId: { shopId: shop.id, userId } },
    });
    return { following: false };
  }
  await prisma.shopFollow.create({ data: { shopId: shop.id, userId } });
  return { following: true };
}

export async function addShopReview(
  userId: string,
  slug: string,
  input: { rating: number; body: string },
) {
  const shop = await prisma.shop.findUnique({ where: { slug } });
  if (!shop) {
    throw new ShopError("Shop not found.", "NOT_FOUND");
  }
  if (!canFollowOrReviewShop({ userId, ownerUserId: shop.ownerUserId })) {
    throw new ShopError("You cannot review your own shop.", "SELF_ACTION");
  }

  return prisma.shopReview.upsert({
    where: { shopId_authorUserId: { shopId: shop.id, authorUserId: userId } },
    update: { rating: input.rating, body: input.body },
    create: {
      shopId: shop.id,
      authorUserId: userId,
      rating: input.rating,
      body: input.body,
    },
  });
}

export async function requestShopVerification(userId: string, ipAddress?: string | null) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new ShopError("Create a shop first.", "NOT_FOUND");
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { verificationStatus: "PENDING" },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SHOP_VERIFICATION_REQUESTED,
    targetType: "Shop",
    targetId: shop.id,
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function staffVerifyShop(
  actorUserId: string,
  slug: string,
  status: "VERIFIED" | "REJECTED",
  note?: string,
  ipAddress?: string | null,
) {
  const actor = await loadActor(actorUserId);
  const types = actor.kobaIdentities.map((row) => row.accountType);
  if (!canVerifyShop(types)) {
    throw new ShopError("Only KOBA Admin or Superadmin can verify shops.", "FORBIDDEN");
  }

  const shop = await prisma.shop.findUnique({ where: { slug } });
  if (!shop) {
    throw new ShopError("Shop not found.", "NOT_FOUND");
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: {
      verificationStatus: status,
      verificationNote: note ?? null,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.SHOP_VERIFIED,
    targetType: "Shop",
    targetId: shop.id,
    metadata: { status, slug },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function getShopAnalytics(userId: string) {
  const shop = await getOwnedShop(userId);
  if (!shop) {
    return null;
  }

  const [approved, pending, draft, inventory] = await Promise.all([
    prisma.product.count({
      where: { shopId: shop.id, moderationStatus: "APPROVED", publishedAt: { not: null } },
    }),
    prisma.product.count({ where: { shopId: shop.id, moderationStatus: "PENDING" } }),
    prisma.product.count({ where: { shopId: shop.id, moderationStatus: "DRAFT" } }),
    prisma.product.aggregate({
      where: { shopId: shop.id },
      _sum: { inventoryQty: true },
    }),
  ]);

  const orders = await prisma.order.groupBy({
    by: ["status"],
    where: { shopId: shop.id },
    _count: { _all: true },
  });

  const orderCounts = {
    PENDING: 0,
    PAID: 0,
    FULFILLED: 0,
    CANCELLED: 0,
    REFUNDED: 0,
  };
  for (const row of orders) {
    orderCounts[row.status] = row._count._all;
  }

  return {
    shop,
    listings: { approved, pending, draft },
    followers: shop._count.follows,
    reviews: shop._count.reviews,
    inventoryQty: inventory._sum.inventoryQty ?? 0,
    orders: orderCounts,
  };
}

export async function listShopOrders(userId: string) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new ShopError("Create a shop first.", "NOT_FOUND");
  }
  await assertCanManageShop(userId, shop.id);

  return prisma.order.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true, buyer: { select: { name: true } } },
  });
}
