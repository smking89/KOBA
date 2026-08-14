import { prisma } from "@/lib/db";

export class FavoriteError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "FavoriteError";
  }
}

export async function toggleFavorite(userId: string, slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      moderationStatus: "APPROVED",
      publishedAt: { not: null },
    },
    select: { id: true },
  });

  if (!product) {
    throw new FavoriteError("Product not found.", "NOT_FOUND");
  }

  const existing = await prisma.productFavorite.findUnique({
    where: { userId_productId: { userId, productId: product.id } },
  });

  if (existing) {
    await prisma.productFavorite.delete({
      where: { userId_productId: { userId, productId: product.id } },
    });
    return { favorited: false };
  }

  await prisma.productFavorite.create({
    data: { userId, productId: product.id },
  });
  return { favorited: true };
}
