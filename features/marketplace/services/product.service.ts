import { prisma } from "@/lib/db";
import {
  buildProductOrderBy,
  buildPublicProductWhere,
} from "@/features/marketplace/lib/product-query";
import type { MarketQuery } from "@/features/marketplace/schemas/market.schemas";
import type {
  PublicProductCard,
  PublicProductDetail,
  PublicSeller,
} from "@/features/marketplace/lib/product-dto";
import type { GamePlatform, ListingType, ProductRarity } from "@/features/marketplace/lib/catalog";

const productInclude = {
  game: { select: { slug: true, name: true } },
  category: { select: { slug: true, name: true } },
  media: { orderBy: { sortOrder: "asc" as const } },
  variants: { orderBy: { createdAt: "asc" as const } },
  seller: {
    select: {
      name: true,
      profile: { select: { displayName: true } },
      kobaIdentities: { select: { accountType: true, code: true } },
    },
  },
} satisfies Record<string, unknown>;

type ProductRecord = Awaited<
  ReturnType<typeof prisma.product.findFirst<{ include: typeof productInclude }>>
>;

function sellerFrom(product: NonNullable<ProductRecord>): PublicSeller {
  const identities = product.seller.kobaIdentities;
  const kobaId =
    identities.find((identity) => identity.accountType === "BUSINESS")?.code ??
    identities.find((identity) => identity.accountType === "PLAYER")?.code ??
    identities[0]?.code ??
    null;

  return {
    displayName: product.seller.profile?.displayName ?? product.seller.name ?? "KOBA seller",
    kobaId,
  };
}

function stockQty(product: NonNullable<ProductRecord>): number {
  if (product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + variant.inventoryQty, 0);
  }
  return product.inventoryQty;
}

function toCard(product: NonNullable<ProductRecord>, favorited: boolean): PublicProductCard {
  return {
    slug: product.slug,
    title: product.title,
    rarity: product.rarity as ProductRarity,
    listingType: product.listingType as ListingType,
    priceCents: product.priceCents,
    currency: product.currency,
    inStock: stockQty(product) > 0,
    platforms: product.platforms as GamePlatform[],
    game: product.game,
    category: product.category,
    seller: sellerFrom(product),
    thumbnailAlt: product.media[0]?.alt ?? product.title,
    favorited,
  };
}

export async function listPublicProducts(query: MarketQuery, viewerUserId?: string | null) {
  const where = buildPublicProductWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: buildProductOrderBy(query.sort),
      skip,
      take: query.pageSize,
    }),
  ]);

  const favoriteSlugs = new Set<string>();
  if (viewerUserId && rows.length > 0) {
    const favorites = await prisma.productFavorite.findMany({
      where: {
        userId: viewerUserId,
        productId: { in: rows.map((row) => row.id) },
      },
      select: { product: { select: { slug: true } } },
    });
    for (const favorite of favorites) {
      favoriteSlugs.add(favorite.product.slug);
    }
  }

  return {
    items: rows.map((row) => toCard(row, favoriteSlugs.has(row.slug))),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getPublicProduct(
  slug: string,
  viewerUserId?: string | null,
): Promise<PublicProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      moderationStatus: "APPROVED",
      publishedAt: { not: null },
    },
    include: productInclude,
  });

  if (!product) {
    return null;
  }

  let favorited = false;
  if (viewerUserId) {
    const favorite = await prisma.productFavorite.findUnique({
      where: { userId_productId: { userId: viewerUserId, productId: product.id } },
    });
    favorited = Boolean(favorite);
  }

  const qty = stockQty(product);

  return {
    ...toCard(product, favorited),
    description: product.description,
    inventoryQty: qty,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      name: variant.name,
      priceCents: variant.priceCents ?? product.priceCents,
      inventoryQty: variant.inventoryQty,
    })),
    media: product.media.map((item) => ({
      url: item.url,
      alt: item.alt,
      kind: item.kind,
    })),
  };
}

export async function listGames() {
  return prisma.game.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true, kind: true },
  });
}
