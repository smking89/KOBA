import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { RARITY_RANK } from "@/features/marketplace/lib/catalog";
import {
  SELLER_CREATE_STATUS,
  SELLER_SUBMIT_STATUS,
  canApproveListing,
  slugify,
} from "@/features/shops/lib/access";
import { ShopError, assertCanManageShop } from "@/features/shops/services/shop.service";
import type { UpsertProductInput } from "@/features/shops/schemas/shop.schemas";

async function requireOwnedShop(userId: string) {
  const shop = await prisma.shop.findFirst({
    where: {
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
  });
  if (!shop) {
    throw new ShopError("Create a shop before managing products.", "NOT_FOUND");
  }
  await assertCanManageShop(userId, shop.id);
  return shop;
}

async function uniqueProductSlug(title: string) {
  let slug = slugify(title);
  const exists = await prisma.product.findUnique({ where: { slug } });
  if (exists) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

export async function listSellerProducts(userId: string) {
  const shop = await requireOwnedShop(userId);
  return prisma.product.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
    include: { game: true, category: true },
  });
}

export async function getSellerProduct(userId: string, slug: string) {
  const shop = await requireOwnedShop(userId);
  const product = await prisma.product.findFirst({
    where: { slug, shopId: shop.id },
    include: { game: true, category: true },
  });
  if (!product) {
    throw new ShopError("Product not found in your shop.", "NOT_FOUND");
  }
  return product;
}

export async function createSellerProduct(userId: string, input: UpsertProductInput) {
  const shop = await requireOwnedShop(userId);
  const [game, category] = await Promise.all([
    prisma.game.findUnique({ where: { slug: input.gameSlug } }),
    prisma.category.findUnique({ where: { slug: input.categorySlug } }),
  ]);
  if (!game || !category) {
    throw new ShopError("Unknown game or category.", "NOT_FOUND");
  }

  const product = await prisma.product.create({
    data: {
      slug: await uniqueProductSlug(input.title),
      title: input.title,
      description: input.description,
      rarity: input.rarity,
      rarityRank: RARITY_RANK[input.rarity],
      listingType: input.listingType,
      moderationStatus: SELLER_CREATE_STATUS,
      priceCents: input.priceCents,
      inventoryQty: input.inventoryQty,
      platforms: input.platforms,
      sellerUserId: shop.ownerUserId,
      shopId: shop.id,
      gameId: game.id,
      categoryId: category.id,
      publishedAt: null,
    },
  });

  return product;
}

export async function updateSellerProduct(userId: string, slug: string, input: UpsertProductInput) {
  const shop = await requireOwnedShop(userId);
  const product = await prisma.product.findFirst({
    where: { slug, shopId: shop.id },
  });
  if (!product) {
    throw new ShopError("Product not found in your shop.", "NOT_FOUND");
  }

  const [game, category] = await Promise.all([
    prisma.game.findUnique({ where: { slug: input.gameSlug } }),
    prisma.category.findUnique({ where: { slug: input.categorySlug } }),
  ]);
  if (!game || !category) {
    throw new ShopError("Unknown game or category.", "NOT_FOUND");
  }

  return prisma.product.update({
    where: { id: product.id },
    data: {
      title: input.title,
      description: input.description,
      rarity: input.rarity,
      rarityRank: RARITY_RANK[input.rarity],
      listingType: input.listingType,
      priceCents: input.priceCents,
      inventoryQty: input.inventoryQty,
      platforms: input.platforms,
      gameId: game.id,
      categoryId: category.id,
      moderationStatus:
        product.moderationStatus === "APPROVED" ? "PENDING" : product.moderationStatus,
      publishedAt: product.moderationStatus === "APPROVED" ? null : product.publishedAt,
    },
  });
}

export async function submitSellerProduct(userId: string, slug: string, ipAddress?: string | null) {
  const shop = await requireOwnedShop(userId);
  const product = await prisma.product.findFirst({ where: { slug, shopId: shop.id } });
  if (!product) {
    throw new ShopError("Product not found in your shop.", "NOT_FOUND");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { moderationStatus: SELLER_SUBMIT_STATUS },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PRODUCT_SUBMITTED,
    targetType: "Product",
    targetId: product.id,
    metadata: { slug },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}

export async function staffApproveProduct(
  actorUserId: string,
  slug: string,
  ipAddress?: string | null,
) {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  const types = actor?.kobaIdentities.map((row) => row.accountType) ?? [];
  if (!canApproveListing(types)) {
    throw new ShopError("Staff only.", "FORBIDDEN");
  }

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) {
    throw new ShopError("Product not found.", "NOT_FOUND");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditAction.PRODUCT_APPROVED,
    targetType: "Product",
    targetId: product.id,
    metadata: { slug },
    ipAddress: ipAddress ?? null,
  });

  return updated;
}
