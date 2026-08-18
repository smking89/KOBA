import { prisma } from "@/lib/db";
import { activeBoostedTargetIds } from "@/features/boost/services/boost.service";
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
import type {
  FreebiePolicy,
  GamePlatform,
  ListingType,
  ProductRarity,
} from "@/features/marketplace/lib/catalog";

const productInclude = {
  game: { select: { slug: true, name: true } },
  category: { select: { slug: true, name: true } },
  media: { orderBy: { sortOrder: "asc" as const } },
  variants: { orderBy: { createdAt: "asc" as const } },
  shop: {
    select: {
      slug: true,
      verificationStatus: true,
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true } },
    },
  },
  auction: true,
  seller: {
    select: {
      name: true,
      profile: { select: { displayName: true, handle: true } },
      kobaIdentities: { select: { accountType: true, code: true } },
      ownedShop: { select: { slug: true, verificationStatus: true } },
    },
  },
  _count: {
    select: {
      favorites: true,
      comments: { where: { moderationStatus: "LIVE" as const } },
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
    handle: product.seller.profile?.handle ?? null,
    kobaId,
    shopSlug: product.seller.ownedShop?.slug ?? product.shop?.slug ?? null,
    verified: product.seller.ownedShop?.verificationStatus === "VERIFIED",
  };
}

function shopRating(product: NonNullable<ProductRecord>): {
  shopRatingAvg: number | null;
  shopReviewCount: number;
} {
  if (!product.shop) {
    return { shopRatingAvg: null, shopReviewCount: 0 };
  }
  const count = product.shop._count.reviews;
  if (count === 0) {
    return { shopRatingAvg: null, shopReviewCount: 0 };
  }
  const sum = product.shop.reviews.reduce((total, review) => total + review.rating, 0);
  return { shopRatingAvg: sum / count, shopReviewCount: count };
}

function descriptionSnippet(description: string, maxLength = 90): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function stockQty(product: NonNullable<ProductRecord>): number {
  if (product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + variant.inventoryQty, 0);
  }
  return product.inventoryQty;
}

function toCard(
  product: NonNullable<ProductRecord>,
  favorited: boolean,
  saved: boolean,
  boosted: boolean,
): PublicProductCard {
  return {
    slug: product.slug,
    title: product.title,
    rarity: product.rarity as ProductRarity,
    listingType: product.listingType as ListingType,
    priceCents: product.priceCents,
    currency: product.currency,
    inStock: stockQty(product) > 0,
    inventoryQty: stockQty(product),
    platforms: product.platforms as GamePlatform[],
    game: product.game,
    category: product.category,
    seller: sellerFrom(product),
    thumbnailAlt: product.media[0]?.alt ?? product.title,
    thumbnailUrl: product.media[0]?.url ?? null,
    thumbnailKind: (product.media[0]?.kind as "IMAGE" | "VIDEO" | undefined) ?? "IMAGE",
    favorited,
    saved,
    boosted,
    freebiePolicy: product.freebiePolicy as FreebiePolicy,
    descriptionSnippet: descriptionSnippet(product.description),
    ...shopRating(product),
    favoriteCount: product._count.favorites,
    commentCount: product._count.comments,
    auction: product.auction
      ? {
          status: product.auction.status,
          endsAt: product.auction.endsAt.toISOString(),
          highBidCents: product.auction.highBidCents,
          minIncrementCents: product.auction.minIncrementCents,
        }
      : null,
  };
}

export async function listPublicProducts(
  query: MarketQuery,
  viewerUserId?: string | null,
  options?: { shopSlug?: string },
) {
  const where = buildPublicProductWhere(query);
  if (options?.shopSlug) {
    where.shop = { slug: options.shopSlug };
  }
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
  const savedSlugs = new Set<string>();
  if (viewerUserId && rows.length > 0) {
    const [favorites, saves] = await Promise.all([
      prisma.productFavorite.findMany({
        where: {
          userId: viewerUserId,
          productId: { in: rows.map((row) => row.id) },
        },
        select: { product: { select: { slug: true } } },
      }),
      prisma.productSave.findMany({
        where: {
          userId: viewerUserId,
          productId: { in: rows.map((row) => row.id) },
        },
        select: { product: { select: { slug: true } } },
      }),
    ]);
    for (const favorite of favorites) {
      favoriteSlugs.add(favorite.product.slug);
    }
    for (const save of saves) {
      savedSlugs.add(save.product.slug);
    }
  }

  // Boosted-first within this page only — a true global (cross-page)
  // boosted-first sort needs a DB-level CASE/computed-column ordering,
  // deferred (see ROADMAP.md Phase 15). This still gives an active Boost
  // real, visible priority on whichever page the product already sorts
  // into, not just a badge.
  const boostedIds = await activeBoostedTargetIds("PRODUCT");
  const cards = rows
    .map((row) =>
      toCard(row, favoriteSlugs.has(row.slug), savedSlugs.has(row.slug), boostedIds.has(row.id)),
    )
    .sort((a, b) => Number(b.boosted) - Number(a.boosted));

  return {
    items: cards,
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
  let saved = false;
  if (viewerUserId) {
    const [favorite, save] = await Promise.all([
      prisma.productFavorite.findUnique({
        where: { userId_productId: { userId: viewerUserId, productId: product.id } },
      }),
      prisma.productSave.findUnique({
        where: { userId_productId: { userId: viewerUserId, productId: product.id } },
      }),
    ]);
    favorited = Boolean(favorite);
    saved = Boolean(save);
  }

  const boostedIds = await activeBoostedTargetIds("PRODUCT");

  let freebieClaimed = false;
  if (viewerUserId && product.freebiePolicy !== "NONE") {
    const claim = await prisma.freebieClaim.findUnique({
      where: { productId_buyerUserId: { productId: product.id, buyerUserId: viewerUserId } },
    });
    freebieClaimed = Boolean(claim);
  }

  return {
    ...toCard(product, favorited, saved, boostedIds.has(product.id)),
    description: product.description,
    freebieClaimed,
    requiresGameHandle: Boolean(product.rconKitName),
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

export async function listPublicProductsForShop(shopSlug: string, viewerUserId?: string | null) {
  return listPublicProducts(
    { sort: "newest", page: 1, pageSize: 24, game: undefined, category: undefined, q: undefined },
    viewerUserId,
    { shopSlug },
  );
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
