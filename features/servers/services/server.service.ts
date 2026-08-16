import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sealSecret, openSecret } from "@/lib/crypto/secret-box";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { ServerError } from "@/features/servers/lib/errors";
import { generateServerRef, slugifyServer } from "@/features/servers/lib/refs";
import {
  hasCapability,
  type GameServerView,
  type RconTestState,
  type ServerCapability,
} from "@/features/servers/lib/types";
import type { CreateServerInput, RconActionInput } from "@/features/servers/schemas/server.schemas";
import { isPlusActive } from "@/features/plus/services/plus.service";
import { queryProtocolForGame, rconProtocolForGame } from "@/features/servers/lib/rcon/registry";
import { runRconCommand, SourceRconError } from "@/features/servers/lib/rcon/source-rcon";
import { buildGiveKitCommand } from "@/features/servers/lib/rcon/kit-commands";
import {
  queryRustStatusViaRcon,
  runWebRconCommand,
  WebRconError,
} from "@/features/servers/lib/rcon/rust-webrcon";
import { queryServerInfo, SourceQueryError, type SourceServerInfo } from "@/features/servers/lib/rcon/source-query";
import { getCachedServerStatus, setCachedServerStatus } from "@/features/servers/lib/status-cache";

const ownerSelect = {
  id: true,
  name: true,
  profile: { select: { handle: true } },
  kobaIdentities: { select: { accountType: true }, take: 8 },
} as const;

const serverInclude = {
  owner: { select: ownerSelect },
  shop: { select: { slug: true } },
  credential: { select: { id: true, rotatedAt: true } },
  activeMapInventoryItem: { select: { rarity: true, title: true } },
} as const;

type ServerRow = Awaited<ReturnType<typeof loadServer>>;

async function loadServer(serverIdOrSlug: string) {
  const server = await prisma.gameServer.findFirst({
    where: {
      OR: [{ id: serverIdOrSlug }, { slug: serverIdOrSlug }, { publicRef: serverIdOrSlug }],
    },
    include: serverInclude,
  });
  if (!server) {
    throw new ServerError("Server not found.", "NOT_FOUND");
  }
  return server;
}

async function uniqueSlug(name: string): Promise<string> {
  let slug = slugifyServer(name);
  const clash = await prisma.gameServer.findUnique({ where: { slug } });
  if (clash) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

async function assertBusinessOrInfluencer(userId: string) {
  const identities = await prisma.kobaIdentity.findMany({
    where: { userId },
    select: { accountType: true },
  });
  const allowed = identities.some(
    (row) => row.accountType === "BUSINESS" || row.accountType === "INFLUENCER",
  );
  if (!allowed) {
    throw new ServerError(
      "Only Business or Influencer accounts can manage server credentials.",
      "UNAUTHORIZED_ROLE",
    );
  }
}

function toServerView(server: NonNullable<ServerRow>): GameServerView {
  const capabilities = server.capabilities as ServerCapability[];
  const base: GameServerView = {
    publicRef: server.publicRef,
    slug: server.slug,
    name: server.name,
    game: server.game,
    platformFamily: server.platformFamily,
    region: server.region,
    tags: server.tags,
    ownerHandle: server.owner.profile?.handle ?? "player",
    linkedShopSlug: server.shop?.slug ?? null,
    joinInfo: server.joinInfo,
    lastRefreshAt: server.lastRefreshAt?.toISOString() ?? null,
    capabilities,
    activeMapRarity: server.activeMapInventoryItem?.rarity ?? null,
    activeMapTitle: server.activeMapInventoryItem?.title ?? null,
  };

  if (hasCapability(base, "STATUS")) {
    base.status = server.status;
  }
  if (hasCapability(base, "PLAYER_COUNT")) {
    if (server.livePlayers != null) base.livePlayers = server.livePlayers;
    if (server.maxPlayers != null) base.maxPlayers = server.maxPlayers;
  }
  if (hasCapability(base, "QUEUE_COUNT") && server.queue != null) {
    base.queue = server.queue;
  }
  if (hasCapability(base, "MAP_INFO")) {
    if (server.mapName) base.mapName = server.mapName;
    if (server.mapSize) base.mapSize = server.mapSize;
  }
  if (server.pingMs != null && hasCapability(base, "STATUS")) {
    base.pingMs = server.pingMs;
  }

  return base;
}

export async function listDirectory(): Promise<GameServerView[]> {
  const servers = await prisma.gameServer.findMany({
    orderBy: { createdAt: "desc" },
    take: 96,
    include: serverInclude,
  });
  return servers.map(toServerView);
}

export async function getBySlugOrRef(serverIdOrSlug: string): Promise<GameServerView> {
  const server = await loadServer(serverIdOrSlug);
  return toServerView(server);
}

/** GameServerView deliberately omits ownerUserId (only the display-safe
 * ownerHandle) — this is the narrow, real ownership check pages need for
 * "show me owner-only controls," without exposing the raw id elsewhere. */
export async function isServerOwner(userId: string, serverIdOrSlug: string): Promise<boolean> {
  const server = await loadServer(serverIdOrSlug).catch(() => null);
  return server?.ownerUserId === userId;
}

/**
 * A2S_INFO first (unauthenticated, confirmed reachable on PC Source
 * servers). Falls back to Rust's own `status` RCON command over WebRcon
 * when A2S isn't available for this game/platform but RCON is (this is
 * the Console Edition path — see rust-webrcon.ts's confidence note on
 * that parser). Returns null, never a partial/guessed value, if neither
 * path is available or the RCON fallback's parse comes back empty.
 */
async function queryLiveStatus(
  server: NonNullable<ServerRow> & { host: string; port: number },
): Promise<SourceServerInfo | null> {
  const a2sProtocol = queryProtocolForGame(server.game, server.platformFamily);
  if (a2sProtocol) {
    try {
      return await queryServerInfo({ host: server.host, port: server.port });
    } catch (error) {
      if (!(error instanceof SourceQueryError)) {
        throw error;
      }
      return null;
    }
  }

  const rconProtocol = rconProtocolForGame(server.game, server.platformFamily);
  if (rconProtocol !== "RUST_WEBRCON") {
    return null;
  }
  const credential = await prisma.serverCredential.findUnique({ where: { serverId: server.id } });
  if (!credential) {
    return null;
  }
  try {
    const password = openSecret(credential);
    const status = await queryRustStatusViaRcon({ host: server.host, port: server.port, password });
    if (status.players === null || status.maxPlayers === null) {
      return null; // parse didn't find the expected shape — fail closed, not a guess
    }
    return {
      serverName: status.hostname ?? server.name,
      mapName: status.mapName ?? "",
      players: status.players,
      maxPlayers: status.maxPlayers,
    };
  } catch {
    return null;
  }
}

/**
 * On-demand, cached live query (client-confirmed polling model,
 * 2026-08-15) — queried only when a server's page is viewed, cached
 * ~45s (features/servers/lib/status-cache.ts), no scheduled background
 * sweep of every registered server. Null for any server without a real
 * protocol adapter (console, or a game with no adapter) — never a
 * fabricated/estimated value.
 */
export async function getLiveServerStatus(
  serverIdOrSlug: string,
): Promise<SourceServerInfo | null> {
  const server = await loadServer(serverIdOrSlug);
  const host = server.host;
  const port = server.port;
  if (!host || port == null) {
    return null;
  }

  const cached = await getCachedServerStatus(server.id);
  if (cached) {
    return cached;
  }

  const info = await queryLiveStatus({ ...server, host, port });
  if (!info) {
    return null;
  }

  await setCachedServerStatus(server.id, info);

  if (hasCapability(server, "STATUS")) {
    await prisma.gameServer.update({
      where: { id: server.id },
      data: {
        livePlayers: info.players,
        maxPlayers: info.maxPlayers,
        mapName: info.mapName,
        lastRefreshAt: new Date(),
      },
    });
  }

  return info;
}

export async function createServer(
  userId: string,
  input: CreateServerInput,
  ipAddress?: string | null,
): Promise<GameServerView> {
  await assertBusinessOrInfluencer(userId);

  const publicRef = generateServerRef();
  const slug = await uniqueSlug(input.name);
  const defaultCaps: ServerCapability[] =
    input.platformFamily === "PC" ? ["STATUS", "PC"] : ["STATUS", "CONSOLE"];

  const server = await prisma.gameServer.create({
    data: {
      publicRef,
      slug,
      name: input.name,
      game: input.game,
      platformFamily: input.platformFamily,
      region: input.region,
      tags: input.tags,
      ownerUserId: userId,
      ...(input.shopId !== undefined ? { shopId: input.shopId } : {}),
      ...(input.joinInfo !== undefined ? { joinInfo: input.joinInfo } : {}),
      ...(input.host !== undefined ? { host: input.host } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      capabilities: input.capabilities ?? defaultCaps,
    },
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_REGISTERED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { publicRef, slug },
    ipAddress: ipAddress ?? null,
  });

  return toServerView(server);
}

async function assertOwner(server: { ownerUserId: string }, userId: string) {
  if (server.ownerUserId !== userId) {
    throw new ServerError("Only the server owner can manage credentials.", "FORBIDDEN");
  }
}

export async function upsertRconCredential(
  userId: string,
  serverIdOrSlug: string,
  password: string,
  opts?: { host?: string; port?: number },
  ipAddress?: string | null,
) {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  const sealed = sealSecret(password);

  await prisma.$transaction(async (tx) => {
    await tx.serverCredential.upsert({
      where: { serverId: server.id },
      create: {
        serverId: server.id,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
      },
      update: {
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        rotatedAt: new Date(),
      },
    });
    if (opts?.host !== undefined || opts?.port !== undefined) {
      await tx.gameServer.update({
        where: { id: server.id },
        data: {
          ...(opts.host !== undefined ? { host: opts.host } : {}),
          ...(opts.port !== undefined ? { port: opts.port } : {}),
        },
      });
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_RCON_UPDATED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: "rotate" },
    ipAddress: ipAddress ?? null,
  });

  return { ok: true as const, rconConfigured: true };
}

/**
 * Opens a real Source RCON connection and authenticates — replaces the
 * old host/port-truthiness stub. UNSUPPORTED for any game/platform combo
 * without a real protocol adapter (features/servers/lib/rcon/registry.ts)
 * — console servers always fall here today, not a bug, see that file's
 * doc comment.
 */
export async function testRconConnection(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
): Promise<{ state: RconTestState }> {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  const host = server.host;
  const port = server.port;
  const protocol = rconProtocolForGame(server.game, server.platformFamily);

  let state: RconTestState;
  if (!host || port == null || !protocol) {
    state = "UNSUPPORTED";
  } else {
    const credential = await prisma.serverCredential.findUnique({ where: { serverId: server.id } });
    if (!credential) {
      state = "UNSUPPORTED";
    } else {
      try {
        const password = openSecret(credential);
        if (protocol === "RUST_WEBRCON") {
          await runWebRconCommand({ host, port, password, command: "status", timeoutMs: 5000 });
        } else {
          await runRconCommand({ host, port, password, timeoutMs: 5000 });
        }
        state = "SUCCESS";
      } catch (error) {
        if (error instanceof SourceRconError || error instanceof WebRconError) {
          state = error.kind === "AUTH_FAILED" ? "AUTH_FAILED" : "TIMEOUT";
        } else {
          state = "TIMEOUT";
        }
      }
    }
  }

  await prisma.gameServer.update({
    where: { id: server.id },
    data: { rconTestState: state },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_RCON_UPDATED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: "test", state },
    ipAddress: ipAddress ?? null,
  });

  return { state };
}

/**
 * Delivers a pre-built Rust `kit` (set up by the server owner in-panel —
 * KOBA doesn't create kits, only triggers `kit givetoplayer`) to a
 * player by gamertag/Steam persona over RCON. Same command syntax on
 * PC and console (the `kit` Oxide/uMod plugin, see kit-commands.ts) —
 * only the transport differs, already abstracted by rconProtocolForGame.
 *
 * This is the item-delivery primitive Phase 22 (Discord Bot) needs;
 * not yet wired to order fulfillment — that needs the Discord
 * account-linking flow (gamertag capture) this phase doesn't have yet.
 */
export async function giveKitToPlayer(
  userId: string,
  serverIdOrSlug: string,
  kitName: string,
  gamertag: string,
  ipAddress?: string | null,
): Promise<{ state: RconTestState }> {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  const host = server.host;
  const port = server.port;
  const protocol = rconProtocolForGame(server.game, server.platformFamily);

  let state: RconTestState;
  if (!host || port == null || !protocol) {
    state = "UNSUPPORTED";
  } else {
    const credential = await prisma.serverCredential.findUnique({ where: { serverId: server.id } });
    if (!credential) {
      state = "UNSUPPORTED";
    } else {
      try {
        const password = openSecret(credential);
        const command = buildGiveKitCommand(kitName, gamertag);
        if (protocol === "RUST_WEBRCON") {
          await runWebRconCommand({ host, port, password, command, timeoutMs: 5000 });
        } else {
          await runRconCommand({ host, port, password, command, timeoutMs: 5000 });
        }
        state = "SUCCESS";
      } catch (error) {
        if (error instanceof SourceRconError || error instanceof WebRconError) {
          state = error.kind === "AUTH_FAILED" ? "AUTH_FAILED" : "TIMEOUT";
        } else {
          state = "TIMEOUT";
        }
      }
    }
  }

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_KIT_DELIVERED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { kitName, gamertag, state },
    ipAddress: ipAddress ?? null,
  });

  return { state };
}

export async function rotateCredentials(
  userId: string,
  serverIdOrSlug: string,
  password: string,
  opts?: { host?: string; port?: number },
  ipAddress?: string | null,
) {
  return upsertRconCredential(userId, serverIdOrSlug, password, opts, ipAddress);
}

export async function disconnect(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
) {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  await prisma.$transaction(async (tx) => {
    await tx.serverCredential.deleteMany({ where: { serverId: server.id } });
    await tx.gameServer.update({
      where: { id: server.id },
      data: { rconTestState: "IDLE", host: null, port: null },
    });
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_RCON_UPDATED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: "disconnect" },
    ipAddress: ipAddress ?? null,
  });

  return { ok: true as const, rconConfigured: false };
}

export async function handleRconAction(
  userId: string,
  serverIdOrSlug: string,
  input: RconActionInput,
  ipAddress?: string | null,
) {
  switch (input.action) {
    case "test":
      return testRconConnection(userId, serverIdOrSlug, ipAddress);
    case "rotate": {
      const opts: { host?: string; port?: number } = {};
      if (input.host !== undefined) opts.host = input.host;
      if (input.port !== undefined) opts.port = input.port;
      return rotateCredentials(userId, serverIdOrSlug, input.password, opts, ipAddress);
    }
    case "disconnect":
      return disconnect(userId, serverIdOrSlug, ipAddress);
    default:
      throw new ServerError("Unknown RCON action.", "INVALID");
  }
}

/** Public read — no Plus gate, everyone can see a per-server bio, only
 * setting one is a Plus perk. Null if the user hasn't set one. */
export async function getServerBio(
  userId: string,
  serverIdOrSlug: string,
): Promise<string | null> {
  const server = await loadServer(serverIdOrSlug);
  const bio = await prisma.serverBio.findUnique({
    where: { userId_gameServerId: { userId, gameServerId: server.id } },
  });
  return bio?.bio ?? null;
}

/** KOBA Plus perk: a bio that can differ per game-server community,
 * distinct from AccountProfile.bio (account-wide). Gated to active Plus
 * subscribers — checked here, not at the route, so the rule can't be
 * bypassed by calling the service directly from another surface later. */
export async function setServerBio(
  userId: string,
  serverIdOrSlug: string,
  bio: string,
): Promise<string> {
  const [server, hasPlus] = await Promise.all([
    loadServer(serverIdOrSlug),
    isPlusActive(userId),
  ]);
  if (!hasPlus) {
    throw new ServerError("Per-server bios are a KOBA Plus perk.", "FORBIDDEN");
  }

  const row = await prisma.serverBio.upsert({
    where: { userId_gameServerId: { userId, gameServerId: server.id } },
    create: { userId, gameServerId: server.id, bio },
    update: { bio },
  });
  return row.bio;
}

/**
 * Server "rarity" (client clarification, 2026-08-15): the owner marks
 * one of their own owned Maps — an InventoryItem originating from a
 * MAPS-category marketplace purchase (see fulfillOrder in
 * checkout.service.ts, which is what actually grants these) — as this
 * server's active map. Rarity is then read off that item, never a
 * separate field the owner sets directly.
 */
export async function setActiveMap(
  userId: string,
  serverIdOrSlug: string,
  inventoryItemPublicRef: string,
  ipAddress?: string | null,
): Promise<GameServerView> {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  const item = await prisma.inventoryItem.findUnique({
    where: { publicRef: inventoryItemPublicRef },
  });
  if (!item || item.ownerUserId !== userId) {
    throw new ServerError("You don't own that item.", "FORBIDDEN");
  }
  const product = item.productId
    ? await prisma.product.findUnique({
        where: { id: item.productId },
        select: { category: { select: { kind: true } } },
      })
    : null;
  if (!product || product.category.kind !== "MAPS") {
    throw new ServerError("Only a purchased Map can be set as a server's active map.", "INVALID");
  }

  const updated = await prisma.gameServer.update({
    where: { id: server.id },
    data: { activeMapInventoryItemId: item.id },
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_ACTIVE_MAP_SET,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { inventoryItemId: item.id },
    ipAddress: ipAddress ?? null,
  });

  return toServerView(updated);
}

export async function clearActiveMap(
  userId: string,
  serverIdOrSlug: string,
): Promise<GameServerView> {
  await assertBusinessOrInfluencer(userId);
  const server = await loadServer(serverIdOrSlug);
  await assertOwner(server, userId);

  const updated = await prisma.gameServer.update({
    where: { id: server.id },
    data: { activeMapInventoryItemId: null },
    include: serverInclude,
  });
  return toServerView(updated);
}

/** Owned, MAPS-category items eligible to set as a server's active map —
 * feeds the owner-facing picker (features/servers/components/
 * active-map-panel.tsx). */
export async function listMyOwnedMaps(
  userId: string,
): Promise<{ publicRef: string; title: string; rarity: string }[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { ownerUserId: userId, productId: { not: null } },
    select: { publicRef: true, title: true, rarity: true, productId: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (items.length === 0) {
    return [];
  }
  const productIds = [...new Set(items.map((item) => item.productId).filter((id): id is string => id !== null))];
  const mapProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, category: { kind: "MAPS" } },
    select: { id: true },
  });
  const mapProductIds = new Set(mapProducts.map((p) => p.id));
  return items
    .filter((item) => item.productId && mapProductIds.has(item.productId))
    .map((item) => ({ publicRef: item.publicRef, title: item.title, rarity: item.rarity }));
}
