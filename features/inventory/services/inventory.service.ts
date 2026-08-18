import type {
  GamePlatform,
  InventoryAcquisitionSource,
  InventoryItemStatus,
  ProductRarity,
  Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TradeError } from "@/features/trade/lib/errors";
import { generateInventoryRef } from "@/features/trade/lib/refs";

export type InventoryItemPublicView = {
  publicRef: string;
  title: string;
  game: string;
  platform: GamePlatform;
  rarity: ProductRarity;
  ownerHandle: string;
  listedForTrade: boolean;
  transferable: boolean;
  status: InventoryItemStatus;
  locked: boolean;
};

export type CreateInventoryItemInput = {
  ownerUserId: string;
  title: string;
  game: string;
  platform: GamePlatform;
  rarity: ProductRarity;
  transferable?: boolean;
  listedForTrade?: boolean;
  acquisitionSource?: InventoryAcquisitionSource;
  publicRef?: string;
  productId?: string | null;
  aidenAssetId?: string | null;
  serial?: string | null;
};

const ownerSelect = {
  profile: { select: { handle: true } },
} as const;

type InventoryRow = {
  publicRef: string;
  title: string;
  game: string;
  platform: GamePlatform;
  rarity: ProductRarity;
  listedForTrade: boolean;
  transferable: boolean;
  status: InventoryItemStatus;
  lockTradeOfferId: string | null;
  owner: { profile: { handle: string | null } | null };
};

function mapPublicView(item: InventoryRow): InventoryItemPublicView {
  return {
    publicRef: item.publicRef,
    title: item.title,
    game: item.game,
    platform: item.platform,
    rarity: item.rarity,
    ownerHandle: item.owner.profile?.handle ?? "player",
    listedForTrade: item.listedForTrade,
    transferable: item.transferable,
    status: item.status,
    locked: item.lockTradeOfferId !== null || item.status !== "ACTIVE",
  };
}

/** Create an inventory item (seed / grants). Idempotent when `publicRef` is provided. */
export async function createInventoryItem(input: CreateInventoryItemInput) {
  const publicRef = input.publicRef ?? generateInventoryRef();

  if (input.publicRef) {
    const existing = await prisma.inventoryItem.findUnique({
      where: { publicRef: input.publicRef },
      include: { owner: { select: ownerSelect } },
    });
    if (existing) {
      return mapPublicView(existing);
    }
  }

  const created = await prisma.inventoryItem.create({
    data: {
      publicRef,
      ownerUserId: input.ownerUserId,
      title: input.title,
      game: input.game,
      platform: input.platform,
      rarity: input.rarity,
      transferable: input.transferable ?? true,
      listedForTrade: input.listedForTrade ?? false,
      acquisitionSource: input.acquisitionSource ?? "GRANT",
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.aidenAssetId !== undefined ? { aidenAssetId: input.aidenAssetId } : {}),
      ...(input.serial !== undefined ? { serial: input.serial } : {}),
    },
    include: { owner: { select: ownerSelect } },
  });

  return mapPublicView(created);
}

export type ListTradeableInventoryInput = {
  game?: string;
  platform?: GamePlatform;
  rarity?: ProductRarity;
  query?: string;
  cursor?: string;
  limit?: number;
};

/** Public discovery: only listed, transferable, ACTIVE, unlocked items. */
export async function listTradeableInventory(
  input: ListTradeableInventoryInput = {},
): Promise<{ items: InventoryItemPublicView[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 48, 1), 100);
  const where: Prisma.InventoryItemWhereInput = {
    listedForTrade: true,
    transferable: true,
    status: "ACTIVE",
    lockTradeOfferId: null,
    ...(input.game ? { game: { equals: input.game, mode: "insensitive" } } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.rarity ? { rarity: input.rarity } : {}),
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { game: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.inventoryItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor
      ? {
          cursor: { publicRef: input.cursor },
          skip: 1,
        }
      : {}),
    include: { owner: { select: ownerSelect } },
  });

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? (page[page.length - 1]?.publicRef ?? null) : null;

  return { items: page.map(mapPublicView), nextCursor };
}

export type InventoryValueSummary = {
  itemCount: number;
  totalValueCents: number;
};

/**
 * Owned-inventory stat for the player dashboard: how many items the player
 * still holds (anything short of TRANSFERRED/REVOKED counts as owned, even
 * while locked in a trade/auction/order/dispute) and their combined value,
 * priced off the originating Product where one is linked. Items minted
 * without a productId (e.g. AIDEN generations) contribute to the count but
 * not the total, since there's no price to attribute to them.
 */
export async function getInventoryValueSummary(userId: string): Promise<InventoryValueSummary> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      ownerUserId: userId,
      status: { notIn: ["TRANSFERRED", "REVOKED"] },
    },
    select: { productId: true },
  });

  const productIds = [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))];

  const priceById = new Map(
    productIds.length
      ? (
          await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, priceCents: true },
          })
        ).map((product) => [product.id, product.priceCents] as const)
      : [],
  );

  const totalValueCents = items.reduce(
    (sum, item) => sum + (item.productId ? (priceById.get(item.productId) ?? 0) : 0),
    0,
  );

  return { itemCount: items.length, totalValueCents };
}

/** Caller's own transferable ACTIVE (or TRADE_LOCKED) inventory for composing offers. */
export async function listMyTradeable(userId: string): Promise<InventoryItemPublicView[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: {
      ownerUserId: userId,
      transferable: true,
      status: { in: ["ACTIVE", "TRADE_LOCKED"] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    include: { owner: { select: ownerSelect } },
  });
  return rows.map(mapPublicView);
}

export async function setListedForTrade(
  userId: string,
  publicRef: string,
  listed: boolean,
): Promise<InventoryItemPublicView> {
  const item = await prisma.inventoryItem.findUnique({
    where: { publicRef },
    include: { owner: { select: ownerSelect } },
  });
  if (!item) {
    throw new TradeError("Inventory item not found.", "NOT_FOUND");
  }
  if (item.ownerUserId !== userId) {
    throw new TradeError("You do not own this inventory item.", "FORBIDDEN");
  }
  if (!item.transferable) {
    throw new TradeError("This item is not transferable.", "INVALID");
  }
  if (item.status !== "ACTIVE" || item.lockTradeOfferId) {
    throw new TradeError("Locked items cannot change listing status.", "LOCKED");
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { listedForTrade: listed },
    include: { owner: { select: ownerSelect } },
  });
  return mapPublicView(updated);
}
