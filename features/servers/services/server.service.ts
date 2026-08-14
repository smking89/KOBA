import { randomBytes } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sealSecret } from "@/lib/crypto/secret-box";
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
  const state: RconTestState =
    !host || port == null ? "UNSUPPORTED" : "SUCCESS";

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
