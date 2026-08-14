import {
  AuditAction,
  type GamePlatform,
  type ProductRarity,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { TradeError } from "@/features/trade/lib/errors";
import { generateTradeRef } from "@/features/trade/lib/refs";
import {
  sameRarityTier,
  type TradeOfferView,
  type TradeItemView,
  type TradeState,
} from "@/features/trade/lib/types";
import type { CreateTradeInput, TransitionTradeInput } from "@/features/trade/schemas/trade.schemas";

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

function handleOf(user: UserPublic): string {
  return user.profile?.handle ?? "player";
}

const tradeInclude = {
  proposer: { select: userPublic },
  counterparty: { select: userPublic },
  items: { orderBy: { createdAt: "asc" as const } },
} as const;

type TradeRow = Awaited<ReturnType<typeof loadTradeByRef>>;

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

function mapItem(
  item: {
    id: string;
    side: "OFFERED" | "REQUESTED";
    title: string;
    game: string;
    platform: GamePlatform;
    rarity: ProductRarity;
    locked: boolean;
    eligible: boolean;
    eligibilityNote: string | null;
  },
  ownerHandle: string,
  viewerUserId: string,
  proposerUserId: string,
  counterpartyUserId: string,
): TradeItemView {
  const ownerUserId = item.side === "OFFERED" ? proposerUserId : counterpartyUserId;
  return {
    id: item.id,
    title: item.title,
    game: item.game,
    platform: item.platform,
    rarity: item.rarity,
    ownerHandle,
    owned: ownerUserId === viewerUserId,
    locked: item.locked,
    eligible: item.eligible,
    eligibilityNote: item.eligibilityNote ?? "",
  };
}

function toTradeView(trade: NonNullable<TradeRow>, viewerUserId: string): TradeOfferView {
  const offered = trade.items.filter((item) => item.side === "OFFERED");
  const requested = trade.items.filter((item) => item.side === "REQUESTED");
  const proposerHandle = handleOf(trade.proposer);
  const counterpartyHandle = handleOf(trade.counterparty);

  return {
    publicRef: trade.publicRef,
    state: trade.state,
    createdAt: trade.createdAt.toISOString(),
    expiresAt: trade.expiresAt?.toISOString() ?? null,
    proposerHandle,
    counterpartyHandle,
    offered: offered.map((item) =>
      mapItem(item, proposerHandle, viewerUserId, trade.proposerUserId, trade.counterpartyUserId),
    ),
    requested: requested.map((item) =>
      mapItem(
        item,
        counterpartyHandle,
        viewerUserId,
        trade.proposerUserId,
        trade.counterpartyUserId,
      ),
    ),
    sameRarityRuleOk: sameRarityTier(offered, requested),
    note: trade.note,
  };
}

function assertParticipant(trade: { proposerUserId: string; counterpartyUserId: string }, userId: string) {
  if (trade.proposerUserId !== userId && trade.counterpartyUserId !== userId) {
    throw new TradeError("You are not a party to this trade.", "FORBIDDEN");
  }
}

function nextState(
  current: TradeState,
  action: TransitionTradeInput["action"],
  userId: string,
  trade: { proposerUserId: string; counterpartyUserId: string },
): TradeState {
  const isProposer = trade.proposerUserId === userId;
  const isCounterparty = trade.counterpartyUserId === userId;

  switch (action) {
    case "accept":
      if (current !== "PENDING" && current !== "COUNTERED") {
        throw new TradeError("Only pending or countered trades can be accepted.", "INVALID");
      }
      if (!isCounterparty) {
        throw new TradeError("Only the counterparty can accept.", "FORBIDDEN");
      }
      return "ACCEPTED";
    case "reject":
      if (current !== "PENDING" && current !== "COUNTERED") {
        throw new TradeError("Only pending or countered trades can be rejected.", "INVALID");
      }
      if (!isCounterparty) {
        throw new TradeError("Only the counterparty can reject.", "FORBIDDEN");
      }
      return "REJECTED";
    case "cancel":
      if (current !== "PENDING") {
        throw new TradeError("Only pending trades can be cancelled.", "INVALID");
      }
      if (!isProposer) {
        throw new TradeError("Only the proposer can cancel a pending trade.", "FORBIDDEN");
      }
      return "CANCELLED";
    case "counter":
      if (current !== "PENDING") {
        throw new TradeError("Only pending trades can be countered.", "INVALID");
      }
      if (!isCounterparty) {
        throw new TradeError("Only the counterparty can counter.", "FORBIDDEN");
      }
      return "COUNTERED";
    case "dispute":
      if (current !== "PENDING" && current !== "ACCEPTED" && current !== "COUNTERED") {
        throw new TradeError("This trade cannot be disputed in its current state.", "INVALID");
      }
      return "DISPUTED";
    case "complete":
      if (current !== "ACCEPTED") {
        throw new TradeError("Only accepted trades can be completed.", "INVALID");
      }
      return "COMPLETED";
    default:
      throw new TradeError("Unknown trade action.", "INVALID");
  }
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
  if (!sameRarityTier(input.offered, input.requested)) {
    throw new TradeError("Offered and requested items must share one rarity tier.", "RARITY_MISMATCH");
  }

  const counterparty = await findUserByKobaId(input.counterpartyKobaId);
  if (counterparty.id === userId) {
    throw new TradeError("You cannot trade with yourself.", "SELF_TRADE");
  }

  const publicRef = generateTradeRef();
  const trade = await prisma.tradeOffer.create({
    data: {
      publicRef,
      state: "PENDING",
      proposerUserId: userId,
      counterpartyUserId: counterparty.id,
      ...(input.note !== undefined ? { note: input.note } : {}),
      items: {
        create: [
          ...input.offered.map((item) => ({
            side: "OFFERED" as const,
            title: item.title,
            game: item.game,
            platform: item.platform,
            rarity: item.rarity,
            locked: item.locked ?? false,
            eligible: item.eligible ?? true,
            ...(item.eligibilityNote !== undefined ? { eligibilityNote: item.eligibilityNote } : {}),
            ...(item.productId !== undefined ? { productId: item.productId } : {}),
          })),
          ...input.requested.map((item) => ({
            side: "REQUESTED" as const,
            title: item.title,
            game: item.game,
            platform: item.platform,
            rarity: item.rarity,
            locked: item.locked ?? false,
            eligible: item.eligible ?? true,
            ...(item.eligibilityNote !== undefined ? { eligibilityNote: item.eligibilityNote } : {}),
            ...(item.productId !== undefined ? { productId: item.productId } : {}),
          })),
        ],
      },
    },
    include: tradeInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.TRADE_CREATED,
    targetType: "TradeOffer",
    targetId: trade.id,
    metadata: { publicRef, counterpartyUserId: counterparty.id },
    ipAddress: ipAddress ?? null,
  });

  return toTradeView(trade, userId);
}

export async function transitionTrade(
  userId: string,
  publicRef: string,
  input: TransitionTradeInput,
  ipAddress?: string | null,
): Promise<TradeOfferView> {
  const trade = await loadTradeByRef(publicRef);
  assertParticipant(trade, userId);

  const state = nextState(trade.state, input.action, userId, trade);

  const updated = await prisma.tradeOffer.update({
    where: { id: trade.id },
    data: {
      state,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    include: tradeInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.TRADE_UPDATED,
    targetType: "TradeOffer",
    targetId: trade.id,
    metadata: {
      publicRef,
      action: input.action,
      from: trade.state,
      to: state,
      // complete does not transfer inventory — audit only
      inventoryTransferred: false,
    },
    ipAddress: ipAddress ?? null,
  });

  return toTradeView(updated, userId);
}
