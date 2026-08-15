import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { slugify } from "@/features/shops/lib/access";
import { ShopError, assertCanManageShop } from "@/features/shops/services/shop.service";
import type { UpsertCosmeticInput } from "@/features/marketplace/schemas/cosmetic.schemas";

async function requireOwnedShop(userId: string) {
  const shop = await prisma.shop.findFirst({
    where: {
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
  });
  if (!shop) {
    throw new ShopError("Create a shop before managing cosmetics.", "NOT_FOUND");
  }
  await assertCanManageShop(userId, shop.id);
  return shop;
}

async function uniqueCosmeticSlug(name: string) {
  let slug = slugify(name);
  const exists = await prisma.cosmetic.findUnique({ where: { slug } });
  if (exists) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

export async function listSellerCosmetics(userId: string) {
  const shop = await requireOwnedShop(userId);
  return prisma.cosmetic.findMany({
    where: { ownerShopId: shop.id },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSellerCosmetic(userId: string, slug: string) {
  const shop = await requireOwnedShop(userId);
  const cosmetic = await prisma.cosmetic.findFirst({ where: { slug, ownerShopId: shop.id } });
  if (!cosmetic) {
    throw new ShopError("Cosmetic not found in your shop.", "NOT_FOUND");
  }
  return cosmetic;
}

export async function createSellerCosmetic(userId: string, input: UpsertCosmeticInput) {
  const shop = await requireOwnedShop(userId);

  return prisma.cosmetic.create({
    data: {
      slug: await uniqueCosmeticSlug(input.name),
      name: input.name,
      description: input.description,
      subType: input.subType,
      rarity: input.rarity,
      priceCents: input.priceCents,
      currency: input.currency,
      ownerShopId: shop.id,
      moderationStatus: "DRAFT",
    },
  });
}

export async function updateSellerCosmetic(
  userId: string,
  slug: string,
  input: UpsertCosmeticInput,
) {
  const shop = await requireOwnedShop(userId);
  const cosmetic = await prisma.cosmetic.findFirst({ where: { slug, ownerShopId: shop.id } });
  if (!cosmetic) {
    throw new ShopError("Cosmetic not found in your shop.", "NOT_FOUND");
  }

  return prisma.cosmetic.update({
    where: { id: cosmetic.id },
    data: {
      name: input.name,
      description: input.description,
      subType: input.subType,
      rarity: input.rarity,
      priceCents: input.priceCents,
      currency: input.currency,
      // Editing returns a live cosmetic to pending, mirroring the product
      // moderation flow (editing a live listing returns it to pending).
      moderationStatus:
        cosmetic.moderationStatus === "APPROVED" ? "PENDING" : cosmetic.moderationStatus,
    },
  });
}

export async function submitSellerCosmetic(userId: string, slug: string) {
  const shop = await requireOwnedShop(userId);
  const cosmetic = await prisma.cosmetic.findFirst({ where: { slug, ownerShopId: shop.id } });
  if (!cosmetic) {
    throw new ShopError("Cosmetic not found in your shop.", "NOT_FOUND");
  }

  return prisma.cosmetic.update({
    where: { id: cosmetic.id },
    data: { moderationStatus: "PENDING" },
  });
}
