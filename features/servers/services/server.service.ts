import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sealSecret } from "@/lib/crypto/secret-box";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { isAnyStaff } from "@/features/admin/lib/access";
import { getAdapter, resolveAdapterKey } from "@/features/servers/adapters/registry";
import { ServerError } from "@/features/servers/lib/errors";
import { buildFreshness, metricState } from "@/features/servers/lib/freshness";
import {
  findDirectoryGame,
  resolveGameName,
  resolveGameSlug,
} from "@/features/servers/lib/game-catalogue";
import { capabilitiesFor } from "@/features/servers/lib/capabilities";
import { generateServerRef, slugifyServer } from "@/features/servers/lib/refs";
import { assertAllowedPort, assertSafeHostname, SsrfError } from "@/features/servers/lib/ssrf";
import {
  type GameServerOwnerView,
  type GameServerView,
  type MetricDisplayState,
  type RconTestState,
  type ServerCapability,
  type ServerOperationalStatus,
  type ServerPublicationStatus,
  type ServerVerificationStatus,
} from "@/features/servers/lib/types";
import type {
  CreateServerInput,
  DirectoryQueryInput,
  RconActionInput,
  StaffServerActionInput,
  UpdateServerInput,
} from "@/features/servers/schemas/server.schemas";

const ownerSelect = {
  id: true,
  name: true,
  profile: { select: { handle: true, activeAccountType: true } },
  kobaIdentities: { select: { accountType: true }, take: 8 },
} as const;

const serverInclude = {
  owner: { select: ownerSelect },
  shop: { select: { slug: true } },
  credential: { select: { id: true, rotatedAt: true } },
  _count: { select: { favourites: true } },
} as const;

type ServerRow = Prisma.GameServerGetPayload<{ include: typeof serverInclude }>;

function mapSsrf(error: unknown): never {
  if (error instanceof SsrfError) {
    throw new ServerError(error.message, "INVALID");
  }
  throw error;
}

function safeHostnameOrThrow(hostname: string) {
  try {
    assertSafeHostname(hostname);
  } catch (error) {
    mapSsrf(error);
  }
}

function safePortOrThrow(port: number, allowedPorts?: readonly number[]) {
  try {
    assertAllowedPort(port, allowedPorts);
  } catch (error) {
    mapSsrf(error);
  }
}

function toDisplayHost(
  hostname: string | null | undefined,
  hideResolvedIp: boolean,
): string | null {
  if (!hostname) return null;
  if (hideResolvedIp && isIP(hostname)) return null;
  return hostname;
}

async function requireManageSnapshot(userId: string) {
  const snapshot = await getAccountSnapshot(userId);
  if (!snapshot) {
    throw new ServerError("Account not found.", "NOT_FOUND");
  }
  if (snapshot.activeAccountType !== "BUSINESS" && snapshot.activeAccountType !== "INFLUENCER") {
    throw new ServerError(
      "Only Business or Influencer accounts can manage servers.",
      "UNAUTHORIZED_ROLE",
    );
  }
  return snapshot;
}

async function uniqueSlug(name: string): Promise<string> {
  let slug = slugifyServer(name);
  const clash = await prisma.gameServer.findUnique({ where: { slug } });
  if (clash) {
    slug = `${slug}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

async function loadServer(serverIdOrSlug: string): Promise<ServerRow> {
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

function assertOwnerMatch(
  server: { ownerUserId: string; ownerAccountType: string },
  userId: string,
  activeAccountType: string,
) {
  if (server.ownerUserId !== userId || server.ownerAccountType !== activeAccountType) {
    throw new ServerError(
      "Only the owning Business or Influencer account can manage this server.",
      "FORBIDDEN",
    );
  }
}

function validateNetworkTarget(opts: {
  gameSlug: string;
  platformFamily: "PC" | "CONSOLE";
  hostname: string | null;
  queryPort: number | null;
  gamePort: number | null;
}) {
  const adapter = getAdapter(resolveAdapterKey(opts.gameSlug, opts.platformFamily));
  const allowed = adapter.allowedPorts();
  if (opts.hostname) {
    safeHostnameOrThrow(opts.hostname);
  }
  if (opts.queryPort != null) {
    safePortOrThrow(opts.queryPort, allowed.length ? allowed : undefined);
  }
  if (opts.gamePort != null) {
    safePortOrThrow(opts.gamePort, allowed.length ? allowed : undefined);
  }
  try {
    adapter.validateTarget({
      gameSlug: opts.gameSlug,
      platformFamily: opts.platformFamily,
      hostname: opts.hostname,
      queryPort: opts.queryPort,
      gamePort: opts.gamePort,
    });
  } catch (error) {
    mapSsrf(error);
  }
}

function resolveGameOrThrow(input: string) {
  try {
    const slug = resolveGameSlug(input);
    const game = findDirectoryGame(slug);
    if (!game) throw new Error("missing");
    return game;
  } catch {
    throw new ServerError("Unsupported game for the directory.", "INVALID");
  }
}

function toPublicView(server: ServerRow, opts?: { favouritedByMe?: boolean }): GameServerView {
  const capabilities = server.capabilities as ServerCapability[];
  const freshness = buildFreshness({
    checkedAt: server.lastRefreshAt,
    lastSuccessfulAt: server.lastSuccessfulAt,
    freshUntil: server.freshUntil,
    source: server.adapterKey,
  });
  const transientFailure = server.pollFailures > 0;

  const statusSupported = capabilities.includes("STATUS");
  const statusState = metricState({
    supported: statusSupported,
    valuePresent: true,
    isStale: freshness.isStale,
    transientFailure,
  });

  const playersState = metricState({
    supported: capabilities.includes("PLAYER_COUNT"),
    valuePresent: server.livePlayers != null,
    isStale: freshness.isStale,
    transientFailure,
  });
  const queueState = metricState({
    supported: capabilities.includes("QUEUE_COUNT"),
    valuePresent: server.queue != null,
    isStale: freshness.isStale,
    transientFailure,
  });
  const mapState = metricState({
    supported: capabilities.includes("MAP_INFO") || capabilities.includes("MAP_SIZE"),
    valuePresent: Boolean(server.mapName || server.mapSize),
    isStale: freshness.isStale,
    transientFailure,
  });
  const pingState = metricState({
    supported: capabilities.includes("PING"),
    valuePresent: server.pingMs != null,
    isStale: freshness.isStale,
    transientFailure,
  });

  const view: GameServerView = {
    publicRef: server.publicRef,
    slug: server.slug,
    name: server.name,
    description: server.description,
    game: resolveGameName(server.game),
    gameSlug: findDirectoryGame(server.game)?.slug ?? server.game,
    platformFamily: server.platformFamily,
    region: server.region,
    country: server.country,
    tags: server.tags,
    ownerHandle: server.owner.profile?.handle ?? "player",
    ownerAccountType: server.ownerAccountType,
    linkedShopSlug: server.shop?.slug ?? null,
    joinInfo: server.joinInfo,
    displayHost: toDisplayHost(server.hostname ?? server.host, server.hideResolvedIp),
    verificationStatus: server.verificationStatus as ServerVerificationStatus,
    publicationStatus: server.publicationStatus as ServerPublicationStatus,
    favouriteCount: server._count.favourites,
    favouritedByMe: opts?.favouritedByMe ?? false,
    capabilities,
    freshness,
    statusState,
    playersState,
    queueState,
    mapState,
    pingState,
  };

  if (
    statusSupported &&
    (statusState === "AVAILABLE" || statusState === "STALE" || statusState === "UNKNOWN")
  ) {
    view.status = (server.operationalStatus ?? server.status) as ServerOperationalStatus;
  }

  if (playersState === "AVAILABLE" || playersState === "STALE") {
    if (server.livePlayers != null) view.livePlayers = server.livePlayers;
    if (server.maxPlayers != null) view.maxPlayers = server.maxPlayers;
  }
  if (queueState === "AVAILABLE" || queueState === "STALE") {
    if (server.queue != null) view.queue = server.queue;
  }
  if (mapState === "AVAILABLE" || mapState === "STALE" || mapState === "UNKNOWN") {
    if (capabilities.includes("MAP_INFO") && server.mapName) view.mapName = server.mapName;
    if (capabilities.includes("MAP_SIZE") && server.mapSize) view.mapSize = server.mapSize;
  }
  if (pingState === "AVAILABLE" || pingState === "STALE") {
    if (server.pingMs != null) view.pingMs = server.pingMs;
  }

  return view;
}

function toOwnerView(server: ServerRow, opts?: { favouritedByMe?: boolean }): GameServerOwnerView {
  return {
    ...toPublicView(server, opts),
    adapterKey: server.adapterKey,
    hostname: server.hostname ?? server.host,
    queryPort: server.queryPort,
    gamePort: server.gamePort ?? server.port,
    hideResolvedIp: server.hideResolvedIp,
    verificationToken: server.verificationToken,
    verificationNote: server.verificationNote,
    pollFailures: server.pollFailures,
    nextPollAt: server.nextPollAt?.toISOString() ?? null,
    rconConfigured: Boolean(server.credential),
    rconTestState: server.rconTestState as RconTestState,
  };
}

async function favouritedSet(userId: string | null | undefined, serverIds: string[]) {
  if (!userId || serverIds.length === 0) return new Set<string>();
  const rows = await prisma.serverFavourite.findMany({
    where: { userId, serverId: { in: serverIds } },
    select: { serverId: true },
  });
  return new Set(rows.map((row) => row.serverId));
}

export async function listDirectory(
  query: Partial<DirectoryQueryInput> & { limit?: number } = {},
  viewerUserId?: string | null,
): Promise<{ items: GameServerView[]; nextCursor: string | null }> {
  const limit = query.limit ?? 24;
  // hasSlots needs a column compare — over-fetch then filter in memory.
  const fetchLimit = query.hasSlots ? Math.min(limit * 4, 96) : limit;
  const gameMeta = query.game ? findDirectoryGame(query.game) : undefined;

  const rows = await prisma.gameServer.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
      ...(query.game
        ? {
            OR: [
              { game: { equals: query.game, mode: "insensitive" } },
              ...(gameMeta
                ? [
                    { game: { equals: gameMeta.slug, mode: "insensitive" as const } },
                    { game: { equals: gameMeta.name, mode: "insensitive" as const } },
                  ]
                : []),
            ],
          }
        : {}),
      ...(query.platform ? { platformFamily: query.platform } : {}),
      ...(query.region ? { region: { contains: query.region, mode: "insensitive" } } : {}),
      ...(query.status ? { operationalStatus: query.status } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { region: { contains: query.q, mode: "insensitive" } },
              { game: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.hasSlots ? { livePlayers: { not: null }, maxPlayers: { not: null } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: fetchLimit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
    include: serverInclude,
  });

  let filtered = rows;
  if (query.hasSlots) {
    filtered = rows.filter(
      (row) =>
        row.livePlayers != null && row.maxPlayers != null && row.livePlayers < row.maxPlayers,
    );
  }

  const page = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit ? (page[page.length - 1]?.id ?? null) : null;
  const favs = await favouritedSet(
    viewerUserId,
    page.map((row) => row.id),
  );

  return {
    items: page.map((row) => toPublicView(row, { favouritedByMe: favs.has(row.id) })),
    nextCursor,
  };
}

export async function getBySlugOrRef(
  serverIdOrSlug: string,
  viewerUserId?: string | null,
): Promise<GameServerView> {
  const server = await loadServer(serverIdOrSlug);
  const isPublic =
    server.publicationStatus === "PUBLISHED" && server.verificationStatus === "VERIFIED";

  let isOwner = false;
  if (viewerUserId) {
    const snapshot = await getAccountSnapshot(viewerUserId);
    if (
      snapshot &&
      server.ownerUserId === viewerUserId &&
      server.ownerAccountType === snapshot.activeAccountType
    ) {
      isOwner = true;
    }
  }

  if (!isPublic && !isOwner) {
    throw new ServerError("Server not found.", "NOT_FOUND");
  }
  if (server.publicationStatus === "ARCHIVED" && !isOwner) {
    throw new ServerError("Server not found.", "NOT_FOUND");
  }

  const favs = await favouritedSet(viewerUserId, [server.id]);
  return toPublicView(server, { favouritedByMe: favs.has(server.id) });
}

export async function getOwnerServer(
  userId: string,
  serverIdOrSlug: string,
): Promise<GameServerOwnerView> {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);
  const favs = await favouritedSet(userId, [server.id]);
  return toOwnerView(server, { favouritedByMe: favs.has(server.id) });
}

export async function listAccountServers(userId: string): Promise<GameServerOwnerView[]> {
  const snapshot = await requireManageSnapshot(userId);
  const servers = await prisma.gameServer.findMany({
    where: {
      ownerUserId: userId,
      ownerAccountType: snapshot.activeAccountType,
      publicationStatus: { not: "ARCHIVED" },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: serverInclude,
  });
  const favs = await favouritedSet(
    userId,
    servers.map((row) => row.id),
  );
  return servers.map((row) => toOwnerView(row, { favouritedByMe: favs.has(row.id) }));
}

export async function createServer(
  userId: string,
  input: CreateServerInput,
  ipAddress?: string | null,
): Promise<GameServerOwnerView> {
  const snapshot = await requireManageSnapshot(userId);
  const game = resolveGameOrThrow(input.game);

  if (game.platformFamily !== "BOTH" && game.platformFamily !== input.platformFamily) {
    throw new ServerError(`Game ${game.name} does not support ${input.platformFamily}.`, "INVALID");
  }

  const hostname = input.hostname ?? input.host ?? null;
  const queryPort = input.queryPort ?? null;
  const gamePort = input.gamePort ?? input.port ?? null;
  const capabilities = [...capabilitiesFor(game.slug, input.platformFamily)] as ServerCapability[];
  const adapterKey = resolveAdapterKey(game.slug, input.platformFamily);

  validateNetworkTarget({
    gameSlug: game.slug,
    platformFamily: input.platformFamily,
    hostname,
    queryPort,
    gamePort,
  });

  const publicRef = generateServerRef();
  const slug = await uniqueSlug(input.name);
  const verificationToken = randomBytes(16).toString("hex");

  const server = await prisma.gameServer.create({
    data: {
      publicRef,
      slug,
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      game: game.slug,
      platformFamily: input.platformFamily,
      region: input.region,
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      tags: input.tags,
      ownerUserId: userId,
      ownerAccountType: snapshot.activeAccountType,
      ...(input.shopId !== undefined ? { shopId: input.shopId } : {}),
      ...(input.joinInfo !== undefined ? { joinInfo: input.joinInfo } : {}),
      hostname,
      host: hostname,
      queryPort,
      gamePort,
      port: gamePort,
      hideResolvedIp: input.hideResolvedIp ?? true,
      adapterKey,
      capabilities,
      verificationToken,
      ...(input.maxPlayers !== undefined ? { maxPlayers: input.maxPlayers } : {}),
      publicationStatus: "DRAFT",
      verificationStatus: "UNVERIFIED",
      nextPollAt: new Date(),
    },
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_REGISTERED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: {
      publicRef,
      slug,
      game: game.slug,
      ownerAccountType: snapshot.activeAccountType,
    },
    ipAddress: ipAddress ?? null,
  });

  return toOwnerView(server);
}

export async function updateServer(
  userId: string,
  serverIdOrSlug: string,
  input: UpdateServerInput,
  ipAddress?: string | null,
): Promise<GameServerOwnerView> {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

  if (input.publicationStatus === "PUBLISHED" && server.verificationStatus !== "VERIFIED") {
    throw new ServerError("Server must be verified before publishing.", "INVALID");
  }

  const nextHostname =
    input.hostname === undefined ? (server.hostname ?? server.host) : input.hostname;
  const nextQueryPort = input.queryPort === undefined ? server.queryPort : input.queryPort;
  const nextGamePort =
    input.gamePort === undefined ? (server.gamePort ?? server.port) : input.gamePort;

  if (
    input.hostname !== undefined ||
    input.queryPort !== undefined ||
    input.gamePort !== undefined
  ) {
    validateNetworkTarget({
      gameSlug: findDirectoryGame(server.game)?.slug ?? server.game,
      platformFamily: server.platformFamily,
      hostname: nextHostname,
      queryPort: nextQueryPort,
      gamePort: nextGamePort,
    });
  }

  const updated = await prisma.gameServer.update({
    where: { id: server.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.joinInfo !== undefined ? { joinInfo: input.joinInfo } : {}),
      ...(input.shopId !== undefined ? { shopId: input.shopId } : {}),
      ...(input.hostname !== undefined ? { hostname: input.hostname, host: input.hostname } : {}),
      ...(input.queryPort !== undefined ? { queryPort: input.queryPort } : {}),
      ...(input.gamePort !== undefined ? { gamePort: input.gamePort, port: input.gamePort } : {}),
      ...(input.hideResolvedIp !== undefined ? { hideResolvedIp: input.hideResolvedIp } : {}),
      ...(input.maxPlayers !== undefined ? { maxPlayers: input.maxPlayers } : {}),
      ...(input.publicationStatus !== undefined
        ? { publicationStatus: input.publicationStatus }
        : {}),
    },
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_REGISTERED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: "update", fields: Object.keys(input) },
    ipAddress: ipAddress ?? null,
  });

  return toOwnerView(updated);
}

export async function archiveServer(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
): Promise<{ ok: true }> {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

  await prisma.gameServer.update({
    where: { id: server.id },
    data: { publicationStatus: "ARCHIVED" },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_SUSPENDED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: "archive" },
    ipAddress: ipAddress ?? null,
  });

  return { ok: true };
}

export async function submitForVerification(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
): Promise<GameServerOwnerView> {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

  if (server.verificationStatus === "VERIFIED") {
    throw new ServerError("Server is already verified.", "CONFLICT");
  }
  if (server.verificationStatus === "PENDING") {
    throw new ServerError("Server is already pending verification.", "CONFLICT");
  }

  const updated = await prisma.gameServer.update({
    where: { id: server.id },
    data: {
      verificationStatus: "PENDING",
      submittedAt: new Date(),
      verificationNote: null,
    },
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_SUBMITTED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { verificationTokenPresent: Boolean(server.verificationToken) },
    ipAddress: ipAddress ?? null,
  });

  return toOwnerView(updated);
}

export async function staffModerateServer(
  actorUserId: string,
  serverIdOrSlug: string,
  input: StaffServerActionInput,
  ipAddress?: string | null,
): Promise<GameServerView> {
  const identities = await prisma.kobaIdentity.findMany({
    where: { userId: actorUserId },
    select: { accountType: true },
  });
  if (!isAnyStaff(identities.map((row) => row.accountType))) {
    throw new ServerError("Staff only.", "FORBIDDEN");
  }

  const server = await loadServer(serverIdOrSlug);
  let data: Prisma.GameServerUpdateInput;
  let auditAction: AuditAction;

  switch (input.action) {
    case "approve":
      data = {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        verificationNote: input.note ?? null,
        publicationStatus:
          server.publicationStatus === "DRAFT" ? "PUBLISHED" : server.publicationStatus,
      };
      auditAction = AuditAction.SERVER_VERIFIED;
      break;
    case "reject":
      data = {
        verificationStatus: "REJECTED",
        verificationNote: input.reason,
        publicationStatus: "DRAFT",
      };
      auditAction = AuditAction.SERVER_REJECTED;
      break;
    case "suspend":
      data = {
        publicationStatus: "SUSPENDED",
        suspendedAt: new Date(),
        verificationNote: input.reason,
      };
      auditAction = AuditAction.SERVER_SUSPENDED;
      break;
    case "restore":
      data = {
        publicationStatus: "PUBLISHED",
        suspendedAt: null,
        verificationNote: input.reason,
      };
      auditAction = AuditAction.SERVER_RESTORED;
      break;
    default:
      throw new ServerError("Unknown staff action.", "INVALID");
  }

  const updated = await prisma.gameServer.update({
    where: { id: server.id },
    data,
    include: serverInclude,
  });

  await writeAuditLog({
    actorUserId,
    action: auditAction,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { action: input.action },
    ipAddress: ipAddress ?? null,
  });

  return toOwnerView(updated);
}

export async function listPendingServers(actorUserId: string): Promise<GameServerOwnerView[]> {
  const identities = await prisma.kobaIdentity.findMany({
    where: { userId: actorUserId },
    select: { accountType: true },
  });
  if (!isAnyStaff(identities.map((row) => row.accountType))) {
    throw new ServerError("Staff only.", "FORBIDDEN");
  }

  const servers = await prisma.gameServer.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { submittedAt: "asc" },
    take: 50,
    include: serverInclude,
  });
  return servers.map((row) => toOwnerView(row));
}

export async function toggleFavourite(
  userId: string,
  serverIdOrSlug: string,
): Promise<{ favourited: boolean; favouriteCount: number }> {
  const server = await loadServer(serverIdOrSlug);
  if (server.publicationStatus !== "PUBLISHED" || server.verificationStatus !== "VERIFIED") {
    throw new ServerError("Only published verified servers can be favourited.", "INVALID");
  }

  const existing = await prisma.serverFavourite.findUnique({
    where: { userId_serverId: { userId, serverId: server.id } },
  });

  if (existing) {
    await prisma.serverFavourite.delete({
      where: { userId_serverId: { userId, serverId: server.id } },
    });
  } else {
    await prisma.serverFavourite.create({
      data: { userId, serverId: server.id },
    });
  }

  const favouriteCount = await prisma.serverFavourite.count({ where: { serverId: server.id } });
  return { favourited: !existing, favouriteCount };
}

export async function getPublicStatus(serverIdOrSlug: string): Promise<{
  status: ServerOperationalStatus | undefined;
  statusState: MetricDisplayState;
  playersState: MetricDisplayState;
  livePlayers?: number;
  maxPlayers?: number;
  freshness: GameServerView["freshness"];
  capabilities: readonly ServerCapability[];
}> {
  const view = await getBySlugOrRef(serverIdOrSlug);
  return {
    status: view.status,
    statusState: view.statusState,
    playersState: view.playersState,
    ...(view.livePlayers !== undefined ? { livePlayers: view.livePlayers } : {}),
    ...(view.maxPlayers !== undefined ? { maxPlayers: view.maxPlayers } : {}),
    freshness: view.freshness,
    capabilities: view.capabilities,
  };
}

export async function upsertRconCredential(
  userId: string,
  serverIdOrSlug: string,
  password: string,
  opts?: { host?: string; port?: number },
  ipAddress?: string | null,
) {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

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
      if (opts.host) safeHostnameOrThrow(opts.host);
      if (opts.port != null) safePortOrThrow(opts.port);
      await tx.gameServer.update({
        where: { id: server.id },
        data: {
          ...(opts.host !== undefined ? { host: opts.host, hostname: opts.host } : {}),
          ...(opts.port !== undefined ? { port: opts.port, gamePort: opts.port } : {}),
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

/** Phase 14E will perform a real RCON handshake. */
export async function testRconConnection(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
): Promise<{ state: RconTestState }> {
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

  const state: RconTestState = "UNSUPPORTED";

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
  const snapshot = await requireManageSnapshot(userId);
  const server = await loadServer(serverIdOrSlug);
  assertOwnerMatch(server, userId, snapshot.activeAccountType);

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
