import {
  AuditAction,
  Prisma,
  type GamePlatform,
  type ProductRarity,
  type TradeState as PrismaTradeState,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { generateReportRef } from "@/features/social/lib/refs";
import { TradeError } from "@/features/trade/lib/errors";
import { resolveTradeFee } from "@/features/trade/lib/fee-policy";
import { assertSameRarityTrade, RARITY_VALUE_WARNING } from "@/features/trade/lib/rarity-policy";
import { generateTradeRef } from "@/features/trade/lib/refs";
import { canActorPerform, nextTradeState } from "@/features/trade/lib/state-machine";
import {
  sameRarityTier,
  type TradeItemView,
  type TradeOfferView,
  type TradeState,
} from "@/features/trade/lib/types";
import type {
  CounterTradeInput,
  CreateTradeInput,
  TradeMutationInput,
  TradeReportInput,
} from "@/features/trade/schemas/trade.schemas";
import { WalletError } from "@/features/wallet/lib/errors";
import {
  captureReservation,
  releaseReservation,
  reserveCoins,
} from "@/features/wallet/services/ledger.service";

const userPublic = {
  id: true,
  name: true,
  profile: { select: { handle: true, displayName: true } },
  kobaIdentities: { select: { code: true }, take: 4 },
} as const;

type UserPublic = {
  id: string;
  name: string | null;
  profile: { handle: string | null; displayName: string | null } | null;
  kobaIdentities: { code: string }[];
};

const tradeInclude = {
  proposer: { select: userPublic },
  counterparty: { select: userPublic },
  parentTrade: { select: { publicRef: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      inventoryItem: { select: { publicRef: true, status: true, lockTradeOfferId: true } },
    },
  },
} as const;

type TradeRow = Prisma.TradeOfferGetPayload<{ include: typeof tradeInclude }>;

function handleOf(user: UserPublic): string {
  return user.profile?.handle ?? "player";
}

function mapRarityOrThrow(items: readonly { rarity: ProductRarity }[]): ProductRarity {
  try {
    return assertSameRarityTrade(items);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPTY") {
      throw new TradeError("Trade requires at least one item on each side.", "INVALID");
    }
    throw new TradeError(
      "Offered and requested items must share one rarity tier.",
      "RARITY_MISMATCH",
    );
  }
}

function mapItemView(
  item: TradeRow["items"][number],
  ownerHandle: string,
  viewerUserId: string,
  ownerUserId: string,
): TradeItemView {
  const locked =
    item.inventoryItem.lockTradeOfferId !== null || item.inventoryItem.status === "TRADE_LOCKED";
  return {
    id: item.id,
    inventoryPublicRef: item.inventoryItem.publicRef,
    title: item.titleSnapshot,
    game: item.gameSnapshot,
    platform: item.platformSnapshot,
    rarity: item.raritySnapshot,
    ownerHandle,
    owned: ownerUserId === viewerUserId,
    locked,
    eligible:
      item.inventoryItem.status === "ACTIVE" || item.inventoryItem.status === "TRADE_LOCKED",
    eligibilityNote: locked ? "Locked for an active trade." : "Eligible for trade.",
  };
}

function toTradeView(trade: TradeRow, viewerUserId: string): TradeOfferView {
  const offered = trade.items.filter((item) => item.side === "OFFERED");
  const requested = trade.items.filter((item) => item.side === "REQUESTED");
  const proposerHandle = handleOf(trade.proposer);
  const counterpartyHandle = handleOf(trade.counterparty);
  const viewerRole =
    trade.proposerUserId === viewerUserId
      ? ("proposer" as const)
      : trade.counterpartyUserId === viewerUserId
        ? ("counterparty" as const)
        : null;

  return {
    publicRef: trade.publicRef,
    state: trade.state as TradeState,
    rarityTier: trade.rarityTier,
    createdAt: trade.createdAt.toISOString(),
    expiresAt: trade.expiresAt?.toISOString() ?? null,
    proposerHandle,
    counterpartyHandle,
    offered: offered.map((item) =>
      mapItemView(item, proposerHandle, viewerUserId, trade.proposerUserId),
    ),
    requested: requested.map((item) =>
      mapItemView(item, counterpartyHandle, viewerUserId, trade.counterpartyUserId),
    ),
    sameRarityRuleOk: sameRarityTier(
      offered.map((i) => ({ rarity: i.raritySnapshot })),
      requested.map((i) => ({ rarity: i.raritySnapshot })),
    ),
    note: trade.note,
    parentPublicRef: trade.parentTrade?.publicRef ?? null,
    valueWarning: RARITY_VALUE_WARNING,
    viewerRole,
  };
}

function assertParticipant(
  trade: { proposerUserId: string; counterpartyUserId: string },
  userId: string,
) {
  if (trade.proposerUserId !== userId && trade.counterpartyUserId !== userId) {
    throw new TradeError("You are not a party to this trade.", "FORBIDDEN");
  }
}

function actorRole(
  trade: { proposerUserId: string; counterpartyUserId: string },
  userId: string,
): "proposer" | "counterparty" {
  return trade.proposerUserId === userId ? "proposer" : "counterparty";
}

function assertNotExpired(trade: { expiresAt: Date | null; state: PrismaTradeState }) {
  if (
    trade.expiresAt &&
    trade.expiresAt.getTime() < Date.now() &&
    (trade.state === "PENDING" || trade.state === "COUNTERED")
  ) {
    throw new TradeError("This trade offer has expired.", "EXPIRED");
  }
}

async function findUserByKobaId(code: string) {
  const identity = await prisma.kobaIdentity.findUnique({
    where: { code },
    include: { user: { select: userPublic } },
  });
  if (!identity) {
    throw new TradeError("No account found for that KOBAID.", "NOT_FOUND");
  }
  return identity.user;
}

async function loadTradeByRef(publicRef: string) {
  const trade = await prisma.tradeOffer.findUnique({
    where: { publicRef },
    include: tradeInclude,
  });
  if (!trade) {
    throw new TradeError("Trade not found.", "NOT_FOUND");
  }
  return trade;
}

type InventorySnap = {
  id: string;
  publicRef: string;
  ownerUserId: string;
  title: string;
  game: string;
  platform: GamePlatform;
  rarity: ProductRarity;
  transferable: boolean;
  status: string;
  lockTradeOfferId: string | null;
};

async function loadInventoryByRefs(refs: string[]): Promise<InventorySnap[]> {
  const unique = [...new Set(refs)];
  const rows = await prisma.inventoryItem.findMany({
    where: { publicRef: { in: unique } },
  });
  if (rows.length !== unique.length) {
    throw new TradeError("One or more inventory items were not found.", "NOT_FOUND");
  }
  return rows;
}

function assertItemOwnedTransferable(item: InventorySnap, expectedOwnerId: string, label: string) {
  if (item.ownerUserId !== expectedOwnerId) {
    throw new TradeError(`${label} must be owned by the correct party.`, "FORBIDDEN");
  }
  if (!item.transferable) {
    throw new TradeError(`${label} is not transferable.`, "INVALID");
  }
}

function assertItemAvailableForOffer(
  item: InventorySnap,
  expectedOwnerId: string,
  label: string,
  allowedLockTradeId?: string,
) {
  assertItemOwnedTransferable(item, expectedOwnerId, label);
  const lockedByAllowed =
    allowedLockTradeId &&
    item.lockTradeOfferId === allowedLockTradeId &&
    item.status === "TRADE_LOCKED";
  if (lockedByAllowed) {
    return;
  }
  if (item.status !== "ACTIVE" || item.lockTradeOfferId) {
    throw new TradeError(`${label} is locked or unavailable.`, "LOCKED");
  }
}

function lineCreate(item: InventorySnap, side: "OFFERED" | "REQUESTED") {
  return {
    inventoryItemId: item.id,
    side,
    titleSnapshot: item.title,
    gameSnapshot: item.game,
    platformSnapshot: item.platform,
    raritySnapshot: item.rarity,
    ownerUserIdSnap: item.ownerUserId,
  };
}

async function lockInventoryRows(tx: Prisma.TransactionClient, ids: string[]) {
  const sorted = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM "InventoryItem"
    WHERE id IN (${Prisma.join(sorted)})
    ORDER BY id ASC
    FOR UPDATE
  `;
}

async function releaseTradeLocks(tx: Prisma.TransactionClient, tradeOfferId: string) {
  await tx.inventoryItem.updateMany({
    where: { lockTradeOfferId: tradeOfferId },
    data: { status: "ACTIVE", lockTradeOfferId: null },
  });
}

async function acquireTradeLocks(
  tx: Prisma.TransactionClient,
  tradeOfferId: string,
  itemIds: string[],
) {
  const sorted = [...new Set(itemIds)].sort((a, b) => a.localeCompare(b));
  for (const id of sorted) {
    await tx.inventoryItem.update({
      where: { id },
      data: { status: "TRADE_LOCKED", lockTradeOfferId: tradeOfferId },
    });
  }
}

async function recordTradeEvent(
  tx: Prisma.TransactionClient,
  input: {
    tradeOfferId: string;
    actorUserId?: string | null;
    type:
      | "ACCEPTED"
      | "COMPLETED"
      | "REJECTED"
      | "CANCELLED"
      | "COUNTERED"
      | "EXPIRED"
      | "CREATED"
      | "LOCKED"
      | "UNLOCKED"
      | "DISPUTED"
      | "VOIDED";
    fromState?: PrismaTradeState | null;
    toState?: PrismaTradeState | null;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.tradeEvent.create({
    data: {
      tradeOfferId: input.tradeOfferId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

function mapWalletError(error: unknown): never {
  if (error instanceof WalletError) {
    if (error.code === "INSUFFICIENT") {
      throw new TradeError("Insufficient KOBA Coins for the trade fee.", "INSUFFICIENT");
    }
    throw new TradeError(error.message, error.code === "FORBIDDEN" ? "FORBIDDEN" : "INVALID");
  }
  throw error;
}

export async function listTradesForUser(userId: string): Promise<TradeOfferView[]> {
  const trades = await prisma.tradeOffer.findMany({
    where: {
      OR: [{ proposerUserId: userId }, { counterpartyUserId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: 64,
    include: tradeInclude,
  });
  return trades.map((trade) => toTradeView(trade, userId));
}

export async function getTradeByRef(userId: string, publicRef: string): Promise<TradeOfferView> {
  const trade = await loadTradeByRef(publicRef);
  assertParticipant(trade, userId);
  return toTradeView(trade, userId);
}

export async function createTradeOffer(
  userId: string,
  input: CreateTradeInput,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  const existing = await prisma.tradeOffer.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: tradeInclude,
  });
  if (existing) {
    assertParticipant(existing, userId);
    return toTradeView(existing, userId);
  }

  const counterparty = await findUserByKobaId(input.counterpartyKobaId);
  if (counterparty.id === userId) {
    throw new TradeError("You cannot trade with yourself.", "SELF_TRADE");
  }

  const overlap = input.offeredInventoryRefs.filter((ref) =>
    input.requestedInventoryRefs.includes(ref),
  );
  if (overlap.length > 0) {
    throw new TradeError("An item cannot appear on both sides of a trade.", "INVALID");
  }

  const offered = await loadInventoryByRefs(input.offeredInventoryRefs);
  const requested = await loadInventoryByRefs(input.requestedInventoryRefs);

  for (const item of offered) {
    assertItemAvailableForOffer(item, userId, "Offered item");
  }
  for (const item of requested) {
    assertItemAvailableForOffer(item, counterparty.id, "Requested item");
  }

  const rarityTier = mapRarityOrThrow([
    ...offered.map((i) => ({ rarity: i.rarity })),
    ...requested.map((i) => ({ rarity: i.rarity })),
  ]);

  const expiresInHours = input.expiresInHours ?? 48;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const allItemIds = [...offered, ...requested].map((i) => i.id);

  try {
    const trade = await prisma.$transaction(async (tx) => {
      await lockInventoryRows(tx, allItemIds);

      const fresh = await tx.inventoryItem.findMany({
        where: { id: { in: allItemIds } },
      });
      const byId = new Map(fresh.map((row) => [row.id, row]));
      for (const item of offered) {
        const row = byId.get(item.id);
        if (!row) throw new TradeError("Offered item missing.", "NOT_FOUND");
        assertItemAvailableForOffer(row, userId, "Offered item");
      }
      for (const item of requested) {
        const row = byId.get(item.id);
        if (!row) throw new TradeError("Requested item missing.", "NOT_FOUND");
        assertItemAvailableForOffer(row, counterparty.id, "Requested item");
      }

      const publicRef = generateTradeRef();
      const created = await tx.tradeOffer.create({
        data: {
          publicRef,
          idempotencyKey: input.idempotencyKey,
          state: "PENDING",
          rarityTier,
          proposerUserId: userId,
          counterpartyUserId: counterparty.id,
          expiresAt,
          ...(input.note !== undefined ? { note: input.note } : {}),
          items: {
            create: [
              ...offered.map((item) => lineCreate(item, "OFFERED")),
              ...requested.map((item) => lineCreate(item, "REQUESTED")),
            ],
          },
        },
      });

      await acquireTradeLocks(tx, created.id, allItemIds);
      await recordTradeEvent(tx, {
        tradeOfferId: created.id,
        actorUserId: userId,
        type: "CREATED",
        fromState: null,
        toState: "PENDING",
        metadata: { publicRef },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: created.id,
        actorUserId: userId,
        type: "LOCKED",
        toState: "PENDING",
        metadata: { itemIds: allItemIds },
      });

      return tx.tradeOffer.findUniqueOrThrow({
        where: { id: created.id },
        include: tradeInclude,
      });
    });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.TRADE_CREATED,
      targetType: "TradeOffer",
      targetId: trade.id,
      metadata: { publicRef: trade.publicRef, counterpartyUserId: counterparty.id },
      ipAddress: ipAddress ?? null,
    });

    return toTradeView(trade, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.tradeOffer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: tradeInclude,
      });
      if (raced) {
        assertParticipant(raced, userId);
        return toTradeView(raced, userId);
      }
    }
    throw error;
  }
}

export async function acceptTrade(
  userId: string,
  publicRef: string,
  idempotencyKey: string,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  const prior = await loadTradeByRef(publicRef);
  assertParticipant(prior, userId);

  if (prior.state === "COMPLETED") {
    const events = await prisma.tradeEvent.findMany({
      where: { tradeOfferId: prior.id, type: { in: ["ACCEPTED", "COMPLETED"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    const matched = events.some((event) => {
      if (!event.metadataJson) return false;
      try {
        const meta = JSON.parse(event.metadataJson) as { idempotencyKey?: string };
        return meta.idempotencyKey === idempotencyKey;
      } catch {
        return false;
      }
    });
    if (matched || events.length > 0) {
      return toTradeView(prior, userId);
    }
  }

  if (!canActorPerform("accept", actorRole(prior, userId))) {
    throw new TradeError("Only the counterparty can accept.", "FORBIDDEN");
  }

  const fee = resolveTradeFee();
  let reservationPublicRef: string | undefined;

  if (fee.enabled) {
    try {
      const reserved = await reserveCoins({
        userId,
        amount: fee.flatFeeCoins,
        purpose: `Trade fee ${publicRef}`,
        idempotencyKey: `trade-fee-reserve:${idempotencyKey}`,
        actorUserId: userId,
        ipAddress: ipAddress ?? null,
        metadata: { tradePublicRef: publicRef },
      });
      reservationPublicRef = reserved.publicRef;
    } catch (error) {
      mapWalletError(error);
    }
  }

  try {
    let settledNow = false;
    const trade = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TradeOffer" WHERE id = ${prior.id} FOR UPDATE`;

      const locked = await tx.tradeOffer.findUniqueOrThrow({
        where: { id: prior.id },
        include: {
          items: { include: { inventoryItem: true } },
        },
      });

      if (locked.state === "COMPLETED") {
        return tx.tradeOffer.findUniqueOrThrow({
          where: { id: locked.id },
          include: tradeInclude,
        });
      }

      try {
        nextTradeState(locked.state as TradeState, "accept");
      } catch {
        throw new TradeError("Only pending or countered trades can be accepted.", "INVALID");
      }

      assertNotExpired(locked);

      if (locked.counterpartyUserId !== userId) {
        throw new TradeError("Only the counterparty can accept.", "FORBIDDEN");
      }

      const itemIds = locked.items
        .map((line) => line.inventoryItemId)
        .sort((a, b) => a.localeCompare(b));
      await lockInventoryRows(tx, itemIds);

      const inventoryRows = await tx.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        orderBy: { id: "asc" },
      });
      const byId = new Map(inventoryRows.map((row) => [row.id, row]));

      for (const line of locked.items) {
        const item = byId.get(line.inventoryItemId);
        if (!item) {
          throw new TradeError("Trade item missing from inventory.", "NOT_FOUND");
        }
        const expectedOwner =
          line.side === "OFFERED" ? locked.proposerUserId : locked.counterpartyUserId;
        if (item.ownerUserId !== expectedOwner) {
          throw new TradeError("Inventory ownership changed; cannot settle.", "CONFLICT");
        }
        if (!item.transferable) {
          throw new TradeError("An item is no longer transferable.", "INVALID");
        }
        if (item.lockTradeOfferId !== locked.id || item.status !== "TRADE_LOCKED") {
          throw new TradeError("Trade locks are invalid; cannot settle.", "LOCKED");
        }
      }

      mapRarityOrThrow(inventoryRows.map((row) => ({ rarity: row.rarity })));

      const offeredLines = locked.items.filter((line) => line.side === "OFFERED");
      const requestedLines = locked.items.filter((line) => line.side === "REQUESTED");

      const transferIds = [...itemIds].sort((a, b) => a.localeCompare(b));
      for (const id of transferIds) {
        const line = locked.items.find((row) => row.inventoryItemId === id)!;
        const newOwnerId =
          line.side === "OFFERED" ? locked.counterpartyUserId : locked.proposerUserId;
        await tx.inventoryItem.update({
          where: { id },
          data: {
            ownerUserId: newOwnerId,
            status: "ACTIVE",
            lockTradeOfferId: null,
            acquisitionSource: "TRADE",
          },
        });
      }

      const now = new Date();
      const acceptedState = nextTradeState(locked.state as TradeState, "accept");
      const completedState = nextTradeState(acceptedState, "complete");

      await tx.tradeOffer.update({
        where: { id: locked.id },
        data: {
          state: acceptedState,
          acceptedAt: now,
          version: { increment: 1 },
        },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: locked.id,
        actorUserId: userId,
        type: "ACCEPTED",
        fromState: locked.state,
        toState: acceptedState,
        metadata: { idempotencyKey },
      });

      await tx.tradeOffer.update({
        where: { id: locked.id },
        data: {
          state: completedState,
          completedAt: now,
          version: { increment: 1 },
        },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: locked.id,
        actorUserId: userId,
        type: "COMPLETED",
        fromState: acceptedState,
        toState: completedState,
        metadata: {
          idempotencyKey,
          offeredCount: offeredLines.length,
          requestedCount: requestedLines.length,
        },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: locked.id,
        actorUserId: userId,
        type: "UNLOCKED",
        toState: completedState,
        metadata: { itemIds },
      });

      settledNow = true;
      return tx.tradeOffer.findUniqueOrThrow({
        where: { id: locked.id },
        include: tradeInclude,
      });
    });

    if (reservationPublicRef) {
      try {
        if (settledNow) {
          await captureReservation({
            userId,
            reservationPublicRef,
            idempotencyKey: `trade-fee-capture:${idempotencyKey}`,
            actorUserId: userId,
            ipAddress: ipAddress ?? null,
          });
        } else {
          await releaseReservation({
            userId,
            reservationPublicRef,
            idempotencyKey: `trade-fee-release:${idempotencyKey}`,
            actorUserId: userId,
            ipAddress: ipAddress ?? null,
          });
        }
      } catch (error) {
        mapWalletError(error);
      }
    }

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.TRADE_UPDATED,
      targetType: "TradeOffer",
      targetId: trade.id,
      metadata: {
        publicRef,
        action: "accept",
        to: trade.state,
        inventoryTransferred: true,
        idempotencyKey,
      },
      ipAddress: ipAddress ?? null,
    });

    return toTradeView(trade, userId);
  } catch (error) {
    if (reservationPublicRef) {
      try {
        await releaseReservation({
          userId,
          reservationPublicRef,
          idempotencyKey: `trade-fee-release:${idempotencyKey}`,
          actorUserId: userId,
          ipAddress: ipAddress ?? null,
        });
      } catch {
        // best-effort release
      }
    }
    throw error;
  }
}

async function closeTradeWithUnlock(
  userId: string,
  publicRef: string,
  action: "reject" | "cancel",
  idempotencyKey: string,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  const prior = await loadTradeByRef(publicRef);
  assertParticipant(prior, userId);

  const terminalState = action === "reject" ? "REJECTED" : "CANCELLED";
  if (prior.state === terminalState) {
    return toTradeView(prior, userId);
  }

  const role = actorRole(prior, userId);
  if (!canActorPerform(action, role)) {
    throw new TradeError(
      action === "reject" ? "Only the counterparty can reject." : "Only the proposer can cancel.",
      "FORBIDDEN",
    );
  }

  try {
    nextTradeState(prior.state as TradeState, action);
  } catch {
    throw new TradeError(`This trade cannot be ${action}ed in its current state.`, "INVALID");
  }

  const trade = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TradeOffer" WHERE id = ${prior.id} FOR UPDATE`;
    const locked = await tx.tradeOffer.findUniqueOrThrow({ where: { id: prior.id } });

    if (locked.state === terminalState) {
      return tx.tradeOffer.findUniqueOrThrow({
        where: { id: locked.id },
        include: tradeInclude,
      });
    }

    try {
      nextTradeState(locked.state as TradeState, action);
    } catch {
      throw new TradeError(`This trade cannot be ${action}ed in its current state.`, "INVALID");
    }

    if (action === "reject" && locked.counterpartyUserId !== userId) {
      throw new TradeError("Only the counterparty can reject.", "FORBIDDEN");
    }
    if (action === "cancel" && locked.proposerUserId !== userId) {
      throw new TradeError("Only the proposer can cancel.", "FORBIDDEN");
    }

    const next = nextTradeState(locked.state as TradeState, action);
    await releaseTradeLocks(tx, locked.id);

    const now = new Date();
    await tx.tradeOffer.update({
      where: { id: locked.id },
      data: {
        state: next,
        version: { increment: 1 },
        ...(action === "reject" ? { rejectedAt: now } : { cancelledAt: now }),
      },
    });

    await recordTradeEvent(tx, {
      tradeOfferId: locked.id,
      actorUserId: userId,
      type: action === "reject" ? "REJECTED" : "CANCELLED",
      fromState: locked.state,
      toState: next,
      metadata: { idempotencyKey },
    });
    await recordTradeEvent(tx, {
      tradeOfferId: locked.id,
      actorUserId: userId,
      type: "UNLOCKED",
      toState: next,
    });

    return tx.tradeOffer.findUniqueOrThrow({
      where: { id: locked.id },
      include: tradeInclude,
    });
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.TRADE_UPDATED,
    targetType: "TradeOffer",
    targetId: trade.id,
    metadata: { publicRef, action, to: trade.state, idempotencyKey },
    ipAddress: ipAddress ?? null,
  });

  return toTradeView(trade, userId);
}

export async function rejectTrade(
  userId: string,
  publicRef: string,
  input: TradeMutationInput,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  return closeTradeWithUnlock(userId, publicRef, "reject", input.idempotencyKey, ipAddress);
}

export async function cancelTrade(
  userId: string,
  publicRef: string,
  input: TradeMutationInput,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  return closeTradeWithUnlock(userId, publicRef, "cancel", input.idempotencyKey, ipAddress);
}

export async function counterTrade(
  userId: string,
  publicRef: string,
  input: CounterTradeInput,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  const existingChild = await prisma.tradeOffer.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: tradeInclude,
  });
  if (existingChild) {
    assertParticipant(existingChild, userId);
    return toTradeView(existingChild, userId);
  }

  const parent = await loadTradeByRef(publicRef);
  assertParticipant(parent, userId);

  if (!canActorPerform("counter", actorRole(parent, userId))) {
    throw new TradeError("Only the counterparty can counter.", "FORBIDDEN");
  }
  try {
    nextTradeState(parent.state as TradeState, "counter");
  } catch {
    throw new TradeError("Only pending or countered trades can be countered.", "INVALID");
  }
  assertNotExpired(parent);

  if (parent.counterpartyUserId !== userId) {
    throw new TradeError("Only the counterparty can counter.", "FORBIDDEN");
  }

  const originalProposerId = parent.proposerUserId;
  // Counterparty becomes proposer of the child; original proposer becomes counterparty.
  const newProposerId = userId;
  const newCounterpartyId = originalProposerId;

  const overlap = input.offeredInventoryRefs.filter((ref) =>
    input.requestedInventoryRefs.includes(ref),
  );
  if (overlap.length > 0) {
    throw new TradeError("An item cannot appear on both sides of a trade.", "INVALID");
  }

  const offered = await loadInventoryByRefs(input.offeredInventoryRefs);
  const requested = await loadInventoryByRefs(input.requestedInventoryRefs);

  for (const item of offered) {
    assertItemAvailableForOffer(item, newProposerId, "Offered item", parent.id);
  }
  for (const item of requested) {
    assertItemAvailableForOffer(item, newCounterpartyId, "Requested item", parent.id);
  }

  const rarityTier = mapRarityOrThrow([
    ...offered.map((i) => ({ rarity: i.rarity })),
    ...requested.map((i) => ({ rarity: i.rarity })),
  ]);

  const expiresInHours = input.expiresInHours ?? 48;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const allItemIds = [...offered, ...requested].map((i) => i.id);

  try {
    const child = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TradeOffer" WHERE id = ${parent.id} FOR UPDATE`;
      const lockedParent = await tx.tradeOffer.findUniqueOrThrow({ where: { id: parent.id } });

      if (lockedParent.state === "COUNTERED") {
        const raced = await tx.tradeOffer.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: tradeInclude,
        });
        if (raced) return raced;
      }

      try {
        nextTradeState(lockedParent.state as TradeState, "counter");
      } catch {
        throw new TradeError("Only pending or countered trades can be countered.", "INVALID");
      }
      if (lockedParent.counterpartyUserId !== userId) {
        throw new TradeError("Only the counterparty can counter.", "FORBIDDEN");
      }

      await releaseTradeLocks(tx, lockedParent.id);
      const parentNext = nextTradeState(lockedParent.state as TradeState, "counter");
      await tx.tradeOffer.update({
        where: { id: lockedParent.id },
        data: { state: parentNext, version: { increment: 1 } },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: lockedParent.id,
        actorUserId: userId,
        type: "COUNTERED",
        fromState: lockedParent.state,
        toState: parentNext,
        metadata: { idempotencyKey: input.idempotencyKey },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: lockedParent.id,
        actorUserId: userId,
        type: "UNLOCKED",
        toState: parentNext,
      });

      await lockInventoryRows(tx, allItemIds);
      const fresh = await tx.inventoryItem.findMany({ where: { id: { in: allItemIds } } });
      const byId = new Map(fresh.map((row) => [row.id, row]));
      for (const item of offered) {
        const row = byId.get(item.id);
        if (!row) throw new TradeError("Offered item missing.", "NOT_FOUND");
        assertItemAvailableForOffer(row, newProposerId, "Offered item");
      }
      for (const item of requested) {
        const row = byId.get(item.id);
        if (!row) throw new TradeError("Requested item missing.", "NOT_FOUND");
        assertItemAvailableForOffer(row, newCounterpartyId, "Requested item");
      }

      const childRef = generateTradeRef();
      const created = await tx.tradeOffer.create({
        data: {
          publicRef: childRef,
          idempotencyKey: input.idempotencyKey,
          state: "PENDING",
          rarityTier,
          proposerUserId: newProposerId,
          counterpartyUserId: newCounterpartyId,
          parentTradeId: lockedParent.id,
          expiresAt,
          ...(input.note !== undefined ? { note: input.note } : {}),
          items: {
            create: [
              ...offered.map((item) => lineCreate(item, "OFFERED")),
              ...requested.map((item) => lineCreate(item, "REQUESTED")),
            ],
          },
        },
      });

      await acquireTradeLocks(tx, created.id, allItemIds);
      await recordTradeEvent(tx, {
        tradeOfferId: created.id,
        actorUserId: userId,
        type: "CREATED",
        fromState: null,
        toState: "PENDING",
        metadata: { publicRef: childRef, parentPublicRef: lockedParent.publicRef },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: created.id,
        actorUserId: userId,
        type: "LOCKED",
        toState: "PENDING",
        metadata: { itemIds: allItemIds },
      });

      return tx.tradeOffer.findUniqueOrThrow({
        where: { id: created.id },
        include: tradeInclude,
      });
    });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.TRADE_UPDATED,
      targetType: "TradeOffer",
      targetId: parent.id,
      metadata: {
        publicRef,
        action: "counter",
        childPublicRef: child.publicRef,
        idempotencyKey: input.idempotencyKey,
      },
      ipAddress: ipAddress ?? null,
    });

    return toTradeView(child, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.tradeOffer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: tradeInclude,
      });
      if (raced) {
        assertParticipant(raced, userId);
        return toTradeView(raced, userId);
      }
    }
    throw error;
  }
}

export async function expireTrades(now = new Date()): Promise<{ expired: number }> {
  const candidates = await prisma.tradeOffer.findMany({
    where: {
      state: { in: ["PENDING", "COUNTERED"] },
      expiresAt: { lte: now },
    },
    select: { id: true, publicRef: true, state: true },
    take: 100,
  });

  let expired = 0;
  for (const candidate of candidates) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TradeOffer" WHERE id = ${candidate.id} FOR UPDATE`;
      const locked = await tx.tradeOffer.findUniqueOrThrow({ where: { id: candidate.id } });
      if (locked.state !== "PENDING" && locked.state !== "COUNTERED") {
        return;
      }
      if (!locked.expiresAt || locked.expiresAt.getTime() > now.getTime()) {
        return;
      }

      const next = nextTradeState(locked.state as TradeState, "expire");
      await releaseTradeLocks(tx, locked.id);
      await tx.tradeOffer.update({
        where: { id: locked.id },
        data: { state: next, version: { increment: 1 } },
      });
      await recordTradeEvent(tx, {
        tradeOfferId: locked.id,
        actorUserId: null,
        type: "EXPIRED",
        fromState: locked.state,
        toState: next,
      });
      await recordTradeEvent(tx, {
        tradeOfferId: locked.id,
        type: "UNLOCKED",
        toState: next,
      });
      expired += 1;
    });
  }

  return { expired };
}

export async function reportTrade(
  userId: string,
  publicRef: string,
  input: TradeReportInput,
): Promise<{ publicRef: string }> {
  const trade = await loadTradeByRef(publicRef);
  assertParticipant(trade, userId);

  const reportRef = generateReportRef();
  await prisma.contentReport.create({
    data: {
      publicRef: reportRef,
      reporterUserId: userId,
      targetType: "TRADE",
      targetRef: publicRef,
      reason: input.reason,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONTENT_REPORTED,
    targetType: "TRADE",
    targetId: publicRef,
    metadata: { publicRef: reportRef },
  });
  return { publicRef: reportRef };
}
