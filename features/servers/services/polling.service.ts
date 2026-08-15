/**
 * Background status polling — for cron/VPS workers only.
 * NEVER import or call these from page render / RSC paths.
 */
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAdapter } from "@/features/servers/adapters/registry";
import type { NormalizedStatusResult } from "@/features/servers/adapters/types";
import { computeFreshUntil } from "@/features/servers/lib/freshness";
import { resolveSafeTarget, SsrfError, type ResolvedTarget } from "@/features/servers/lib/ssrf";
import type { ServerOperationalStatus } from "@/features/servers/lib/types";

export const POLL_BASE_INTERVAL_MS = 60_000;
export const POLL_MAX_INTERVAL_MS = 30 * 60_000;
export const POLL_CIRCUIT_FAILURES = 5;
export const POLL_CIRCUIT_COOLDOWN_MS = 45 * 60_000;
export const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function computeBackoffMs(failures: number): number {
  if (failures >= POLL_CIRCUIT_FAILURES) return POLL_CIRCUIT_COOLDOWN_MS;
  const exp = POLL_BASE_INTERVAL_MS * 2 ** Math.max(0, failures);
  return Math.min(exp, POLL_MAX_INTERVAL_MS);
}

export function withJitter(ms: number, jitterRatio = 0.2, random = Math.random): number {
  const delta = ms * jitterRatio;
  return Math.round(ms - delta + random() * 2 * delta);
}

/**
 * One failed poll must not mark a server permanently OFFLINE.
 * Use UNKNOWN / DEGRADED and open a longer circuit after N failures.
 */
export function operationalStateAfterFailure(failures: number): ServerOperationalStatus {
  if (failures >= POLL_CIRCUIT_FAILURES) return "DEGRADED";
  if (failures >= 2) return "DEGRADED";
  return "UNKNOWN";
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function selectEligibleServers(opts?: {
  limit?: number;
  now?: Date;
  includeManual?: boolean;
}) {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 40;
  return prisma.gameServer.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }],
      ...(opts?.includeManual ? {} : { adapterKey: { not: "manual" } }),
    },
    orderBy: [{ nextPollAt: "asc" }, { id: "asc" }],
    take: limit,
  });
}

async function writeSnapshot(
  serverId: string,
  result: NormalizedStatusResult,
  checkedAt: Date,
  successfulAt: Date | null,
  freshUntil: Date | null,
) {
  return prisma.serverStatusSnapshot.create({
    data: {
      serverId,
      operationalState: result.operationalState,
      livePlayers: result.livePlayers,
      maxPlayers: result.maxPlayers,
      queue: result.queue,
      mapName: result.mapName,
      mapSize: result.mapSize,
      pingMs: result.pingMs,
      adapterKey: result.source,
      checkedAt,
      successfulAt,
      freshUntil,
      errorCategory: result.errorCategory,
    },
  });
}

export async function pollServer(serverId: string): Promise<{
  serverId: string;
  successful: boolean;
  operationalState: ServerOperationalStatus;
  pollFailures: number;
}> {
  const server = await prisma.gameServer.findUnique({ where: { id: serverId } });
  if (!server) {
    return {
      serverId,
      successful: false,
      operationalState: "UNKNOWN",
      pollFailures: 0,
    };
  }

  const checkedAt = new Date();
  const adapter = getAdapter(server.adapterKey);
  const hostname = server.hostname ?? server.host;
  const port = server.queryPort ?? server.gamePort ?? server.port ?? 0;

  let result: NormalizedStatusResult;
  let target: ResolvedTarget | null = null;

  try {
    if (server.adapterKey === "manual" || !hostname || !port) {
      result = {
        operationalState: "UNKNOWN",
        livePlayers: null,
        maxPlayers: null,
        queue: null,
        mapName: null,
        mapSize: null,
        pingMs: null,
        successful: false,
        errorCategory: "MANUAL_OR_MISSING_TARGET",
        source: adapter.key,
      };
    } else {
      target = await resolveSafeTarget(
        hostname,
        port,
        adapter.allowedPorts().length ? { allowedPorts: adapter.allowedPorts() } : {},
      );
      result = await adapter.queryStatus(target, {
        gameSlug: server.game,
        platformFamily: server.platformFamily,
        hostname,
        queryPort: server.queryPort,
        gamePort: server.gamePort ?? server.port,
      });
    }
  } catch (error) {
    const category = error instanceof SsrfError ? `SSRF_${error.reason}` : "QUERY_FAILED";
    result = {
      operationalState: "UNKNOWN",
      livePlayers: null,
      maxPlayers: null,
      queue: null,
      mapName: null,
      mapSize: null,
      pingMs: null,
      successful: false,
      errorCategory: category,
      source: adapter.key,
    };
  }

  if (result.successful) {
    const freshUntil = computeFreshUntil(checkedAt);
    const nextPollAt = new Date(checkedAt.getTime() + withJitter(POLL_BASE_INTERVAL_MS));

    await writeSnapshot(server.id, result, checkedAt, checkedAt, freshUntil);

    await prisma.gameServer.update({
      where: { id: server.id },
      data: {
        operationalStatus: result.operationalState,
        status: result.operationalState,
        livePlayers: result.livePlayers,
        maxPlayers: result.maxPlayers ?? server.maxPlayers,
        queue: result.queue,
        mapName: result.mapName,
        mapSize: result.mapSize,
        pingMs: result.pingMs,
        lastRefreshAt: checkedAt,
        lastSuccessfulAt: checkedAt,
        freshUntil,
        pollFailures: 0,
        nextPollAt,
      },
    });

    await writeAuditLog({
      actorUserId: null,
      action: AuditAction.SERVER_STATUS_POLL,
      targetType: "GameServer",
      targetId: server.id,
      metadata: {
        successful: true,
        adapterKey: adapter.key,
        operationalState: result.operationalState,
        resolvedIpCount: target?.resolvedIps.length ?? 0,
      },
    });

    return {
      serverId: server.id,
      successful: true,
      operationalState: result.operationalState,
      pollFailures: 0,
    };
  }

  const pollFailures = server.pollFailures + 1;
  const operationalState = operationalStateAfterFailure(pollFailures);
  const nextPollAt = new Date(checkedAt.getTime() + withJitter(computeBackoffMs(pollFailures)));

  await writeSnapshot(server.id, { ...result, operationalState }, checkedAt, null, null);

  await prisma.gameServer.update({
    where: { id: server.id },
    data: {
      operationalStatus: operationalState,
      status: operationalState,
      lastRefreshAt: checkedAt,
      // Keep lastSuccessfulAt / metric columns — freshness expiry marks them stale.
      pollFailures,
      nextPollAt,
      freshUntil: server.freshUntil,
    },
  });

  await writeAuditLog({
    actorUserId: null,
    action: AuditAction.SERVER_STATUS_POLL,
    targetType: "GameServer",
    targetId: server.id,
    metadata: {
      successful: false,
      adapterKey: adapter.key,
      pollFailures,
      operationalState,
      errorCategory: result.errorCategory,
    },
  });

  return {
    serverId: server.id,
    successful: false,
    operationalState,
    pollFailures,
  };
}

export async function runPollBatch(opts?: {
  concurrency?: number;
  limit?: number;
  includeManual?: boolean;
}) {
  const concurrency = opts?.concurrency ?? 4;
  const servers = await selectEligibleServers({
    limit: opts?.limit ?? 40,
    includeManual: opts?.includeManual ?? false,
  });

  const results = await mapWithConcurrency(servers, concurrency, (server) => pollServer(server.id));

  return {
    selected: servers.length,
    succeeded: results.filter((row) => row.successful).length,
    failed: results.filter((row) => !row.successful).length,
    results,
  };
}

export async function retainSnapshots(opts?: { olderThanMs?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const olderThanMs = opts?.olderThanMs ?? SNAPSHOT_RETENTION_MS;
  const cutoff = new Date(now.getTime() - olderThanMs);
  const result = await prisma.serverStatusSnapshot.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
