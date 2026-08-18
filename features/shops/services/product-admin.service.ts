import { randomBytes } from "node:crypto";
import type { GameContentPolicy, ProductCategoryKind } from "@/lib/generated/prisma/client";
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
import {
  activateAuctionForProduct,
  syncAuctionForProduct,
} from "@/features/auctions/services/auction.service";
import {
  gamePolicyDenialReason,
  isListingAllowedForGame,
} from "@/features/marketplace/lib/game-policy";
import { getStripe, isStripeConfigured } from "@/features/payments/lib/stripe";

const SUBSCRIPTION_INTERVAL_TO_STRIPE: Record<"MONTHLY" | "ANNUAL", "month" | "year"> = {
  MONTHLY: "month",
  ANNUAL: "year",
};

/** Stripe Prices are immutable — a subscription listing lazily gets one
 * created the first time it's saved as SUBSCRIPTION, and a fresh
 * replacement whenever the price or interval actually changes (a stale
 * price left attached to old subscriptions is fine; Stripe subscriptions
 * keep billing at whatever price they were created against). No-ops
 * entirely if Stripe isn't configured (local dev without keys) — the
 * listing just can't be checked out until it is, same as any other
 * Stripe-dependent listing in this codebase. */
async function ensureSubscriptionPrice(
  input: UpsertProductInput,
  existingPriceCents: number | undefined,
  existingInterval: string | null | undefined,
  existingStripePriceId: string | null,
): Promise<string | null> {
  if (input.listingType !== "SUBSCRIPTION" || !input.subscriptionInterval) {
    return null;
  }
  if (!isStripeConfigured()) {
    return existingStripePriceId;
  }
  const unchanged =
    existingStripePriceId &&
    existingPriceCents === input.priceCents &&
    existingInterval === input.subscriptionInterval;
  if (unchanged) {
    return existingStripePriceId;
  }
  const price = await getStripe().prices.create({
    unit_amount: input.priceCents,
    currency: "usd",
    recurring: { interval: SUBSCRIPTION_INTERVAL_TO_STRIPE[input.subscriptionInterval] },
    product_data: { name: input.title },
  });
  return price.id;
}

function assertGameAllowsListing(
  game: { name: string; contentPolicy: GameContentPolicy; policyNote: string | null },
  categoryKind: ProductCategoryKind,
) {
  if (!isListingAllowedForGame(game.contentPolicy, categoryKind)) {
    throw new ShopError(
      gamePolicyDenialReason(game.contentPolicy, game.name, game.policyNote),
      "FORBIDDEN",
    );
  }
}

/** A seller can only wire auto-delivery to a GameServer they actually
 * own — the schema only checks shape, not ownership, since
 * rconServerId arrives as a plain string from a form select. */
async function assertOwnsRconServer(ownerUserId: string, rconServerId: string | undefined) {
  if (!rconServerId) return;
  // Stored value is whatever the seller's server picker sends (this
  // repo's convention elsewhere: server.service.ts's loadServer accepts
  // id, slug, or publicRef interchangeably) — match all three here too.
  const server = await prisma.gameServer.findFirst({
    where: {
      ownerUserId,
      OR: [{ id: rconServerId }, { slug: rconServerId }, { publicRef: rconServerId }],
    },
    select: { id: true },
  });
  if (!server) {
    throw new ShopError("That server isn't yours.", "NOT_FOUND");
  }
}

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
    include: { game: true, category: true, auction: true },
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
  assertGameAllowsListing(game, category.kind);
  await assertOwnsRconServer(shop.ownerUserId, input.rconServerId);
  const stripePriceId = await ensureSubscriptionPrice(input, undefined, null, null);

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
      freebiePolicy: input.freebiePolicy,
      freebieQuantityRemaining:
        input.freebiePolicy === "LIMITED_QUANTITY" ? (input.freebieQuantity ?? 0) : null,
      rconServerId: input.rconServerId ?? null,
      rconKitName: input.rconKitName ?? null,
      subscriptionInterval: input.subscriptionInterval ?? null,
      expiryKitName: input.expiryKitName ?? null,
      stripePriceId,
    },
  });

  if (input.listingType === "AUCTION") {
    await syncAuctionForProduct(product.id, {
      durationHours: input.durationHours,
      minIncrementCents: input.minIncrementCents,
    });
  }

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
  assertGameAllowsListing(game, category.kind);
  await assertOwnsRconServer(shop.ownerUserId, input.rconServerId);
  const stripePriceId = await ensureSubscriptionPrice(
    input,
    product.priceCents,
    product.subscriptionInterval,
    product.stripePriceId,
  );

  const updated = await prisma.product.update({
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
      subscriptionInterval: input.subscriptionInterval ?? null,
      expiryKitName: input.expiryKitName ?? null,
      stripePriceId,
      moderationStatus:
        product.moderationStatus === "APPROVED" ? "PENDING" : product.moderationStatus,
      publishedAt: product.moderationStatus === "APPROVED" ? null : product.publishedAt,
      freebiePolicy: input.freebiePolicy,
      // The seller-facing form always submits the intended pool size for a
      // LIMITED_QUANTITY freebie, so saving re-stocks/resets remaining count
      // to that value rather than trying to diff against prior claims.
      freebieQuantityRemaining:
        input.freebiePolicy === "LIMITED_QUANTITY" ? (input.freebieQuantity ?? 0) : null,
      rconServerId: input.rconServerId ?? null,
      rconKitName: input.rconKitName ?? null,
    },
  });

  if (input.listingType === "AUCTION") {
    await syncAuctionForProduct(updated.id, {
      durationHours: input.durationHours,
      minIncrementCents: input.minIncrementCents,
    });
  }

  return updated;
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

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { game: true, category: true },
  });
  if (!product) {
    throw new ShopError("Product not found.", "NOT_FOUND");
  }
  // Defense in depth: re-check at approval time, not just at create/update —
  // catches a game whose policy was tightened after the listing was drafted.
  assertGameAllowsListing(product.game, product.category.kind);

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

  if (updated.listingType === "AUCTION") {
    await activateAuctionForProduct(updated.id);
  }

  return updated;
}
