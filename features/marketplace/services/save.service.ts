import { prisma } from "@/lib/db";

export class SaveError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND",
  ) {
    super(message);
    this.name = "SaveError";
  }
}

/**
 * Toggles a private wishlist/bookmark (ProductSave) — distinct from
 * toggleFavorite's public "like" reaction. Mirrors its exact shape.
 */
export async function toggleProductSave(userId: string, slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      moderationStatus: "APPROVED",
      publishedAt: { not: null },
    },
    select: { id: true },
  });

  if (!product) {
    throw new SaveError("Product not found.", "NOT_FOUND");
  }

  const existing = await prisma.productSave.findUnique({
    where: { userId_productId: { userId, productId: product.id } },
  });

  if (existing) {
    await prisma.productSave.delete({
      where: { userId_productId: { userId, productId: product.id } },
    });
    return { saved: false };
  }

  await prisma.productSave.create({
    data: { userId, productId: product.id },
  });
  return { saved: true };
}
