import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  credentialAad,
  openCredential,
  sealCredential,
  type SealedCredential,
} from "@/lib/crypto/credential-box";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { createRustAdapter, mergePublicAndRcon } from "@/features/servers/adapters/rust";
import { getRuntimeAdapter } from "@/features/servers/adapters/runtime";
import { isReadOnlyIntegrationAdapter } from "@/features/servers/adapters/types";
import type { NormalizedStatusResult } from "@/features/servers/adapters/types";
import { ServerError } from "@/features/servers/lib/errors";
import { buildFreshness, computeFreshUntil } from "@/features/servers/lib/freshness";
import {
  classifyTransportError,
  safeErrorMessage,
  type IntegrationErrorCategory,
} from "@/features/servers/lib/integration-errors";
import { assertNoSecrets } from "@/features/servers/lib/redact";
import { rustAllowedPorts } from "@/features/servers/lib/rust-ports";
import type { RustIntegrationHealth, ServerCapability } from "@/features/servers/lib/types";
import { resolveSafeTarget, SsrfError } from "@/features/servers/lib/ssrf";
import type {
  RustConnectInput,
  RustDisconnectInput,
  RustRotateInput,
  RustTestInput,
} from "@/features/servers/schemas/integration.schemas";

const RUST_CAPS: ServerCapability[] = [
  "STATUS",
  "PLAYER_COUNT",
  "QUEUE_COUNT",
  "MAP_INFO",
  "PING",
  "PUBLIC_QUERY",
  "RCON_READ",
  "PC",
];

export function assertNotImpersonating(
  actor: { impersonatorId?: string | null } | null | undefined,
) {
  if (actor?.impersonatorId) {
    throw new ServerError("Staff impersonation cannot use or reveal credentials.", "FORBIDDEN");
  }
}

async function requireOwner(userId: string, serverIdOrSlug: string) {
  const snapshot = await getAccountSnapshot(userId);
  if (!snapshot) throw new ServerError("Account not found.", "NOT_FOUND");
  if (snapshot.activeAccountType !== "BUSINESS" && snapshot.activeAccountType !== "INFLUENCER") {
    throw new ServerError(
      "Only Business or Influencer accounts can manage server integrations.",
      "UNAUTHORIZED_ROLE",
    );
  }
  const server = await prisma.gameServer.findFirst({
    where: {
      OR: [{ id: serverIdOrSlug }, { slug: serverIdOrSlug }, { publicRef: serverIdOrSlug }],
    },
    include: {
      integrations: { include: { credential: true } },
      notices: { take: 8, orderBy: { createdAt: "desc" } },
    },
  });
  if (!server) throw new ServerError("Server not found.", "NOT_FOUND");
  if (server.ownerUserId !== userId || server.ownerAccountType !== snapshot.activeAccountType) {
    throw new ServerError(
      "Only the owning Business or Influencer account can manage this integration.",
      "FORBIDDEN",
    );
  }
  if (server.game !== "rust" || server.platformFamily !== "PC") {
    throw new ServerError("Rust PC integration is not available for this server.", "UNSUPPORTED");
  }
  return { snapshot, server };
}

async function requireAccountPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    throw new ServerError("Re-authentication requires an account password.", "FORBIDDEN");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new ServerError("Account password is incorrect.", "FORBIDDEN");
  }
}

async function replayIdempotency(
  userId: string,
  serverId: string,
  action: string,
  key: string | undefined,
): Promise<unknown | null> {
  if (!key) return null;
  const row = await prisma.integrationIdempotency.findUnique({
    where: { userId_serverId_action_key: { userId, serverId, action, key } },
  });
  if (!row) return null;
  return JSON.parse(row.responseJson) as unknown;
}

async function storeIdempotency(
  userId: string,
  serverId: string,
  action: string,
  key: string | undefined,
  response: unknown,
) {
  if (!key) return;
  await prisma.integrationIdempotency.upsert({
    where: { userId_serverId_action_key: { userId, serverId, action, key } },
    create: { userId, serverId, action, key, responseJson: JSON.stringify(response) },
    update: { responseJson: JSON.stringify(response) },
  });
}

function mapSsrf(error: unknown): never {
  if (error instanceof SsrfError) {
    throw new ServerError(safeErrorMessage("SSRF_REJECTED"), "INVALID");
  }
  throw error;
}

async function resolveRustTarget(hostname: string, port: number) {
  try {
    return await resolveSafeTarget(hostname, port, { allowedPorts: rustAllowedPorts() });
  } catch (error) {
    mapSsrf(error);
  }
}

function rconStateFromCategory(category: string | null, success: boolean) {
  if (success) return "SUCCESS" as const;
  if (category === "TIMEOUT") return "TIMEOUT" as const;
  if (category === "INVALID_CREDENTIALS") return "AUTH_FAILED" as const;
  if (category === "UNSUPPORTED_SERVER") return "UNSUPPORTED" as const;
  return "AUTH_FAILED" as const;
}

function healthFromStatus(
  server: {
    hostname: string | null;
    host: string | null;
    queryPort: number | null;
    notices: Array<{ id: string; type: string; message: string; createdAt: Date }>;
  },
  integration: {
    status: string;
    mode: string;
    hostname: string | null;
    queryPort: number | null;
    rconPort: number | null;
    lastHealthJson: string | null;
    lastTestedAt: Date | null;
    lastSuccessfulAt: Date | null;
    lastFailureCategory: string | null;
    pollFailures: number;
    circuitOpenedAt: Date | null;
    credential?: { id: string; revokedAt: Date | null } | null;
  } | null,
  status: NormalizedStatusResult | null,
): RustIntegrationHealth {
  let parsed: NormalizedStatusResult | null = status;
  if (!parsed && integration?.lastHealthJson) {
    try {
      parsed = JSON.parse(integration.lastHealthJson) as NormalizedStatusResult;
    } catch {
      parsed = null;
    }
  }
  const freshness = buildFreshness({
    checkedAt: integration?.lastTestedAt ?? null,
    lastSuccessfulAt: integration?.lastSuccessfulAt ?? null,
    freshUntil: integration?.lastSuccessfulAt
      ? computeFreshUntil(integration.lastSuccessfulAt)
      : null,
    source: parsed?.source ?? "rust",
  });
  return assertNoSecrets({
    configured: Boolean(
      integration && integration.status !== "DISCONNECTED" && integration.status !== "REVOKED",
    ),
    credentialsConfigured: Boolean(integration?.credential && !integration.credential.revokedAt),
    status: integration?.status ?? "DISCONNECTED",
    mode: "RCON_READ",
    readOnly: true,
    administrativeCommandsEnabled: false,
    hostname: integration?.hostname ?? server.hostname ?? server.host,
    queryPort: integration?.queryPort ?? server.queryPort,
    rconPort: integration?.rconPort ?? null,
    capabilities: RUST_CAPS,
    lastTestedAt: integration?.lastTestedAt?.toISOString() ?? null,
    lastSuccessfulAt: integration?.lastSuccessfulAt?.toISOString() ?? null,
    lastFailureCategory: integration?.lastFailureCategory ?? null,
    circuitOpen: Boolean(integration?.circuitOpenedAt),
    pollFailures: integration?.pollFailures ?? 0,
    freshness,
    online: parsed?.successful ? parsed.operationalState === "ONLINE" : null,
    livePlayers: parsed?.fieldPresence?.livePlayers === "AVAILABLE" ? parsed.livePlayers : null,
    maxPlayers: parsed?.fieldPresence?.maxPlayers === "AVAILABLE" ? parsed.maxPlayers : null,
    queue: parsed?.fieldPresence?.queue === "AVAILABLE" ? parsed.queue : null,
    mapName: parsed?.fieldPresence?.mapName === "AVAILABLE" ? parsed.mapName : null,
    mapSize: null,
    serverName: parsed?.serverName ?? null,
    serverTags: parsed?.serverTags ?? null,
    rustVersion: parsed?.rustVersion ?? null,
    notices: server.notices.map((notice) => ({
      id: notice.id,
      type: notice.type,
      message: notice.message,
      createdAt: notice.createdAt.toISOString(),
    })),
  });
}

async function recordAttempt(input: {
  serverId: string;
  integrationId?: string | null;
  attemptType: string;
  success: boolean;
  errorCategory?: string | null;
  durationMs: number;
  correlationId: string;
  idempotencyKey?: string;
}) {
  await prisma.integrationAttempt.create({
    data: {
      serverId: input.serverId,
      integrationId: input.integrationId ?? null,
      attemptType: input.attemptType,
      success: input.success,
      errorCategory: input.errorCategory ?? null,
      durationMs: input.durationMs,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
}

async function notifyOwner(serverId: string, ownerUserId: string, type: string, message: string) {
  await prisma.serverOwnerNotice.create({
    data: { serverId, ownerUserId, type, message },
  });
}

async function applyDirectoryMetrics(serverId: string, result: NormalizedStatusResult) {
  const checkedAt = new Date();
  const server = await prisma.gameServer.findUnique({ where: { id: serverId } });
  if (!server) return;
  if (!result.successful) {
    await prisma.serverStatusSnapshot.create({
      data: {
        serverId,
        operationalState: server.operationalStatus,
        livePlayers: server.livePlayers,
        maxPlayers: server.maxPlayers,
        queue: server.queue,
        mapName: server.mapName,
        mapSize: server.mapSize,
        pingMs: server.pingMs,
        adapterKey: result.source,
        checkedAt,
        errorCategory: result.errorCategory,
      },
    });
    return;
  }
  const freshUntil = computeFreshUntil(checkedAt);
  await prisma.serverStatusSnapshot.create({
    data: {
      serverId,
      operationalState: result.operationalState,
      livePlayers:
        result.fieldPresence?.livePlayers === "AVAILABLE" ? result.livePlayers : server.livePlayers,
      maxPlayers:
        result.fieldPresence?.maxPlayers === "AVAILABLE" ? result.maxPlayers : server.maxPlayers,
      queue: result.fieldPresence?.queue === "AVAILABLE" ? result.queue : server.queue,
      mapName: result.fieldPresence?.mapName === "AVAILABLE" ? result.mapName : server.mapName,
      mapSize: server.mapSize,
      pingMs: result.fieldPresence?.pingMs === "AVAILABLE" ? result.pingMs : server.pingMs,
      adapterKey: result.source,
      checkedAt,
      successfulAt: checkedAt,
      freshUntil,
      errorCategory: null,
    },
  });
  await prisma.gameServer.update({
    where: { id: serverId },
    data: {
      operationalStatus: result.operationalState,
      status: result.operationalState,
      ...(result.fieldPresence?.livePlayers === "AVAILABLE"
        ? { livePlayers: result.livePlayers }
        : {}),
      ...(result.fieldPresence?.maxPlayers === "AVAILABLE"
        ? { maxPlayers: result.maxPlayers }
        : {}),
      ...(result.fieldPresence?.queue === "AVAILABLE" ? { queue: result.queue } : {}),
      ...(result.fieldPresence?.mapName === "AVAILABLE" ? { mapName: result.mapName } : {}),
      ...(result.fieldPresence?.pingMs === "AVAILABLE" ? { pingMs: result.pingMs } : {}),
      lastRefreshAt: checkedAt,
      lastSuccessfulAt: checkedAt,
      freshUntil,
      pollFailures: 0,
      adapterKey: "rust",
    },
  });
}

export async function testRustConnection(
  userId: string,
  serverIdOrSlug: string,
  input: RustTestInput,
  ipAddress?: string | null,
  actor?: { impersonatorId?: string | null },
) {
  assertNotImpersonating(actor);
  const { server } = await requireOwner(userId, serverIdOrSlug);
  const correlationId = randomUUID();
  const started = Date.now();
  const adapter = getRuntimeAdapter("rust");
  if (!isReadOnlyIntegrationAdapter(adapter)) {
    throw new ServerError("Rust adapter is not available.", "UNSUPPORTED");
  }
  adapter.validateConfiguration({
    gameSlug: "rust",
    platformFamily: "PC",
    hostname: input.hostname,
    queryPort: input.queryPort ?? null,
    gamePort: null,
    rconPort: input.rconPort,
  });
  const target = await resolveRustTarget(input.hostname, input.rconPort);
  const result = await adapter.testConnection(target, {
    gameSlug: "rust",
    platformFamily: "PC",
    hostname: input.hostname,
    queryPort: input.queryPort ?? null,
    gamePort: null,
    rconPort: input.rconPort,
    password: input.password,
  });
  const durationMs = Date.now() - started;
  await recordAttempt({
    serverId: server.id,
    attemptType: "TEST",
    success: result.successful,
    errorCategory: result.errorCategory,
    durationMs,
    correlationId,
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_INTEGRATION_TESTED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { success: result.successful, errorCategory: result.errorCategory, correlationId },
    ipAddress: ipAddress ?? null,
  });
  await prisma.gameServer.update({
    where: { id: server.id },
    data: { rconTestState: rconStateFromCategory(result.errorCategory, result.successful) },
  });
  if (!result.successful) {
    const category = (result.errorCategory ?? "UNREACHABLE") as IntegrationErrorCategory;
    return {
      ok: false as const,
      state: rconStateFromCategory(result.errorCategory, false),
      errorCategory: result.errorCategory ?? "UNREACHABLE",
      error: safeErrorMessage(
        (INTEGRATION_SAFE.has(category) ? category : "UNREACHABLE") as IntegrationErrorCategory,
      ),
    };
  }
  return { ok: true as const, state: "SUCCESS" as const, errorCategory: null };
}

const INTEGRATION_SAFE = new Set([
  "INVALID_CREDENTIALS",
  "TIMEOUT",
  "UNREACHABLE",
  "UNSUPPORTED_SERVER",
  "PROTOCOL_MISMATCH",
  "RATE_LIMITED",
  "TLS_TRANSPORT_FAILURE",
  "INTERNAL_CONFIGURATION",
  "SSRF_REJECTED",
  "CIRCUIT_OPEN",
]);

async function persistCredential(
  serverId: string,
  integrationId: string,
  password: string,
): Promise<SealedCredential> {
  const sealed = sealCredential(password, credentialAad(serverId, integrationId));
  await prisma.serverCredential.upsert({
    where: { serverId },
    create: {
      serverId,
      integrationId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      authTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
    },
    update: {
      integrationId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      authTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
      rotatedAt: new Date(),
      revokedAt: null,
    },
  });
  return sealed;
}

export async function connectRustIntegration(
  userId: string,
  serverIdOrSlug: string,
  input: RustConnectInput,
  ipAddress?: string | null,
  actor?: { impersonatorId?: string | null },
) {
  assertNotImpersonating(actor);
  await requireAccountPassword(userId, input.accountPassword);
  const { server } = await requireOwner(userId, serverIdOrSlug);
  const replay = await replayIdempotency(userId, server.id, "connect", input.idempotencyKey);
  if (replay) return replay;

  const test = await testRustConnection(userId, server.id, input, ipAddress, actor);
  if (!test.ok) {
    await storeIdempotency(userId, server.id, "connect", input.idempotencyKey, test);
    return test;
  }

  const integration = await prisma.serverIntegration.upsert({
    where: { serverId_provider: { serverId: server.id, provider: "RUST_PC" } },
    create: {
      serverId: server.id,
      provider: "RUST_PC",
      adapterKey: "rust",
      mode: "RCON_READ",
      status: "CONNECTED",
      hostname: input.hostname,
      queryPort: input.queryPort ?? null,
      rconPort: input.rconPort,
      lastTestedAt: new Date(),
      lastSuccessfulAt: new Date(),
      lastFailureCategory: null,
      pollFailures: 0,
      nextPollAt: new Date(),
    },
    update: {
      status: "CONNECTED",
      hostname: input.hostname,
      queryPort: input.queryPort ?? null,
      rconPort: input.rconPort,
      lastTestedAt: new Date(),
      lastSuccessfulAt: new Date(),
      lastFailureCategory: null,
      pollFailures: 0,
      circuitOpenedAt: null,
      revokedAt: null,
      disconnectedAt: null,
      nextPollAt: new Date(),
    },
  });

  await persistCredential(server.id, integration.id, input.password);
  await prisma.gameServer.update({
    where: { id: server.id },
    data: {
      hostname: input.hostname,
      host: input.hostname,
      queryPort: input.queryPort ?? server.queryPort,
      adapterKey: "rust",
      rconTestState: "SUCCESS",
      capabilities: RUST_CAPS,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_INTEGRATION_CONNECTED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { provider: "RUST_PC", mode: "RCON_READ" },
    ipAddress: ipAddress ?? null,
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_CAPABILITY_CHANGED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { capabilities: RUST_CAPS },
    ipAddress: ipAddress ?? null,
  });
  await notifyOwner(
    server.id,
    server.ownerUserId,
    "CONNECTED",
    "Rust read-only integration connected.",
  );
  await prisma.serverIntegrationJob.create({
    data: {
      type: "REFRESH",
      serverId: server.id,
      integrationId: integration.id,
      status: "PENDING",
      correlationId: randomUUID(),
    },
  });

  const health = await getRustIntegration(userId, server.id, actor ? { actor } : {});
  const response = { ok: true as const, state: "SUCCESS" as const, integration: health };
  await storeIdempotency(userId, server.id, "connect", input.idempotencyKey, response);
  return response;
}

export async function getRustIntegration(
  userId: string,
  serverIdOrSlug: string,
  opts?: { staffInspect?: boolean; actor?: { impersonatorId?: string | null } },
): Promise<RustIntegrationHealth> {
  assertNotImpersonating(opts?.actor);
  if (opts?.staffInspect) {
    const { assertStaffAal2 } = await import("@/features/staff-mfa/lib/assurance");
    await assertStaffAal2(userId);
    const server = await prisma.gameServer.findFirst({
      where: {
        OR: [{ id: serverIdOrSlug }, { slug: serverIdOrSlug }, { publicRef: serverIdOrSlug }],
      },
      include: {
        integrations: { include: { credential: { select: { id: true, revokedAt: true } } } },
        notices: { take: 8, orderBy: { createdAt: "desc" } },
      },
    });
    if (!server) throw new ServerError("Server not found.", "NOT_FOUND");
    return healthFromStatus(server, server.integrations[0] ?? null, null);
  }
  const { server } = await requireOwner(userId, serverIdOrSlug);
  return healthFromStatus(server, server.integrations[0] ?? null, null);
}

export async function rotateRustCredentials(
  userId: string,
  serverIdOrSlug: string,
  input: RustRotateInput,
  ipAddress?: string | null,
  actor?: { impersonatorId?: string | null },
) {
  assertNotImpersonating(actor);
  await requireAccountPassword(userId, input.accountPassword);
  const { server } = await requireOwner(userId, serverIdOrSlug);
  const replay = await replayIdempotency(userId, server.id, "rotate", input.idempotencyKey);
  if (replay) return replay;
  const existing = server.integrations[0];
  if (!existing || existing.status === "DISCONNECTED" || existing.status === "REVOKED") {
    throw new ServerError("Connect the integration before rotating credentials.", "INVALID");
  }
  const hostname = input.hostname ?? existing.hostname ?? server.hostname ?? server.host;
  const rconPort = input.rconPort ?? existing.rconPort;
  if (!hostname || rconPort == null) {
    throw new ServerError("Host and RCON port are required.", "INVALID");
  }
  const test = await testRustConnection(
    userId,
    server.id,
    {
      hostname,
      rconPort,
      password: input.password,
      ...(input.queryPort !== undefined
        ? { queryPort: input.queryPort }
        : existing.queryPort != null
          ? { queryPort: existing.queryPort }
          : {}),
    },
    ipAddress,
    actor,
  );
  if (!test.ok) {
    await storeIdempotency(userId, server.id, "rotate", input.idempotencyKey, test);
    return test;
  }
  await persistCredential(server.id, existing.id, input.password);
  await prisma.serverIntegration.update({
    where: { id: existing.id },
    data: {
      status: "CONNECTED",
      hostname,
      rconPort,
      queryPort: input.queryPort ?? existing.queryPort,
      lastSuccessfulAt: new Date(),
      lastFailureCategory: null,
      pollFailures: 0,
      circuitOpenedAt: null,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_CREDENTIAL_ROTATED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { provider: "RUST_PC" },
    ipAddress: ipAddress ?? null,
  });
  await notifyOwner(
    server.id,
    server.ownerUserId,
    "ROTATED",
    "Rust RCON credentials were rotated.",
  );
  const health = await getRustIntegration(userId, server.id, actor ? { actor } : {});
  const response = { ok: true as const, state: "SUCCESS" as const, integration: health };
  await storeIdempotency(userId, server.id, "rotate", input.idempotencyKey, response);
  return response;
}

export async function disconnectRustIntegration(
  userId: string,
  serverIdOrSlug: string,
  input: RustDisconnectInput,
  ipAddress?: string | null,
  actor?: { impersonatorId?: string | null },
) {
  assertNotImpersonating(actor);
  await requireAccountPassword(userId, input.accountPassword);
  const { server } = await requireOwner(userId, serverIdOrSlug);
  const replay = await replayIdempotency(userId, server.id, "disconnect", input.idempotencyKey);
  if (replay) return replay;
  const existing = server.integrations[0];
  if (!existing || existing.status === "DISCONNECTED" || existing.status === "REVOKED") {
    const already = { ok: true as const, rconConfigured: false, status: "DISCONNECTED" as const };
    await storeIdempotency(userId, server.id, "disconnect", input.idempotencyKey, already);
    return already;
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.serverCredential.updateMany({
      where: { serverId: server.id },
      data: { revokedAt: now, ciphertext: "", iv: "", authTag: "" },
    });
    await tx.serverCredential.deleteMany({ where: { serverId: server.id } });
    await tx.serverIntegration.update({
      where: { id: existing.id },
      data: {
        status: "DISCONNECTED",
        disconnectedAt: now,
        revokedAt: now,
        lastHealthJson: null,
      },
    });
    await tx.serverIntegrationJob.updateMany({
      where: { integrationId: existing.id, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await tx.gameServer.update({
      where: { id: server.id },
      data: { rconTestState: "IDLE" },
    });
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_INTEGRATION_DISCONNECTED,
    targetType: "GameServer",
    targetId: server.id,
    metadata: { provider: "RUST_PC" },
    ipAddress: ipAddress ?? null,
  });
  await notifyOwner(
    server.id,
    server.ownerUserId,
    "DISCONNECTED",
    "Rust integration was disconnected.",
  );
  const response = { ok: true as const, rconConfigured: false, status: "DISCONNECTED" as const };
  await storeIdempotency(userId, server.id, "disconnect", input.idempotencyKey, response);
  return response;
}

export async function refreshRustIntegration(
  userId: string,
  serverIdOrSlug: string,
  ipAddress?: string | null,
  actor?: { impersonatorId?: string | null },
) {
  assertNotImpersonating(actor);
  const { server } = await requireOwner(userId, serverIdOrSlug);
  const existing = server.integrations[0];
  if (!existing || existing.status === "DISCONNECTED" || existing.status === "REVOKED") {
    throw new ServerError("No connected Rust integration to refresh.", "INVALID");
  }
  const result = await runRustRefresh(existing.id);
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.SERVER_STATUS_POLL,
    targetType: "GameServer",
    targetId: server.id,
    metadata: {
      source: "owner-refresh",
      success: result.successful,
      errorCategory: result.errorCategory,
    },
    ipAddress: ipAddress ?? null,
  });
  return getRustIntegration(userId, server.id, actor ? { actor } : {});
}

export async function decryptIntegrationPassword(serverId: string, integrationId: string) {
  const credential = await prisma.serverCredential.findUnique({ where: { serverId } });
  if (!credential || credential.revokedAt) {
    throw new ServerError("Credentials are not configured.", "NOT_FOUND");
  }
  return openCredential(
    {
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.authTag,
      keyVersion: credential.keyVersion,
    },
    credentialAad(serverId, integrationId),
  );
}

export async function runRustRefresh(integrationId: string): Promise<NormalizedStatusResult> {
  const integration = await prisma.serverIntegration.findUnique({
    where: { id: integrationId },
    include: { server: true, credential: true },
  });
  if (!integration || !integration.hostname || integration.rconPort == null) {
    return {
      operationalState: "UNKNOWN",
      livePlayers: null,
      maxPlayers: null,
      queue: null,
      mapName: null,
      mapSize: null,
      pingMs: null,
      successful: false,
      errorCategory: "INTERNAL_CONFIGURATION",
      source: "rust",
    };
  }
  const adapter = getRuntimeAdapter("rust");
  const rust = isReadOnlyIntegrationAdapter(adapter) ? adapter : createRustAdapter();
  const queryPort =
    integration.queryPort ?? integration.server.queryPort ?? integration.server.gamePort;
  let publicStatus: NormalizedStatusResult | null = null;
  if (queryPort) {
    try {
      const publicTarget = await resolveSafeTarget(integration.hostname, queryPort, {
        allowedPorts: rustAllowedPorts(),
      });
      publicStatus = await rust.queryPublicStatus(publicTarget, {
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: integration.hostname,
        queryPort,
        gamePort: integration.server.gamePort,
      });
    } catch (error) {
      publicStatus = {
        operationalState: "UNKNOWN",
        livePlayers: null,
        maxPlayers: null,
        queue: null,
        mapName: null,
        mapSize: null,
        pingMs: null,
        successful: false,
        errorCategory: error instanceof SsrfError ? "SSRF_REJECTED" : classifyTransportError(error),
        source: "rust-a2s",
      };
    }
  }

  let rconStatus: NormalizedStatusResult | null = null;
  if (integration.credential && !integration.credential.revokedAt) {
    try {
      const password = openCredential(
        {
          ciphertext: integration.credential.ciphertext,
          iv: integration.credential.iv,
          authTag: integration.credential.authTag,
          keyVersion: integration.credential.keyVersion,
        },
        credentialAad(integration.serverId, integration.id),
      );
      const rconTarget = await resolveSafeTarget(integration.hostname, integration.rconPort, {
        allowedPorts: rustAllowedPorts(),
      });
      rconStatus = await rust.queryReadOnlyStatus(rconTarget, {
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: integration.hostname,
        queryPort: queryPort ?? null,
        gamePort: integration.server.gamePort,
        rconPort: integration.rconPort,
        password,
      });
    } catch (error) {
      rconStatus = {
        operationalState: "UNKNOWN",
        livePlayers: null,
        maxPlayers: null,
        queue: null,
        mapName: null,
        mapSize: null,
        pingMs: null,
        successful: false,
        errorCategory: error instanceof SsrfError ? "SSRF_REJECTED" : classifyTransportError(error),
        source: "rust-webrcon",
      };
    }
  }

  const merged = mergePublicAndRcon(
    publicStatus ?? {
      operationalState: "UNKNOWN",
      livePlayers: null,
      maxPlayers: null,
      queue: null,
      mapName: null,
      mapSize: null,
      pingMs: null,
      successful: false,
      errorCategory: "UNREACHABLE",
      source: "rust-a2s",
    },
    rconStatus,
  );

  const now = new Date();
  if (merged.successful) {
    await prisma.serverIntegration.update({
      where: { id: integration.id },
      data: {
        status: "CONNECTED",
        lastTestedAt: now,
        lastSuccessfulAt: now,
        lastFailureCategory: null,
        lastHealthJson: JSON.stringify(merged),
        pollFailures: 0,
        circuitOpenedAt: null,
        nextPollAt: new Date(now.getTime() + 60_000),
      },
    });
    await applyDirectoryMetrics(integration.serverId, merged);
  } else {
    const pollFailures = integration.pollFailures + 1;
    const circuitOpen = pollFailures >= 5;
    await prisma.serverIntegration.update({
      where: { id: integration.id },
      data: {
        status: circuitOpen ? "DEGRADED" : "FAILED",
        lastTestedAt: now,
        lastFailureCategory: merged.errorCategory,
        lastHealthJson: JSON.stringify(merged),
        pollFailures,
        circuitOpenedAt: circuitOpen ? (integration.circuitOpenedAt ?? now) : null,
        nextPollAt: new Date(
          now.getTime() + (circuitOpen ? 45 * 60_000 : 60_000 * 2 ** Math.min(pollFailures, 4)),
        ),
      },
    });
    if (circuitOpen && !integration.circuitOpenedAt) {
      await writeAuditLog({
        actorUserId: null,
        action: AuditAction.SERVER_CIRCUIT_OPENED,
        targetType: "GameServer",
        targetId: integration.serverId,
        metadata: { pollFailures, errorCategory: merged.errorCategory },
      });
      await notifyOwner(
        integration.serverId,
        integration.server.ownerUserId,
        merged.errorCategory === "INVALID_CREDENTIALS"
          ? "INVALID_CREDENTIALS"
          : "CONNECTION_FAILED",
        merged.errorCategory === "INVALID_CREDENTIALS"
          ? "Rust RCON credentials appear invalid."
          : "Rust integration failed repeatedly and was paused.",
      );
    } else if (merged.errorCategory === "INVALID_CREDENTIALS") {
      await notifyOwner(
        integration.serverId,
        integration.server.ownerUserId,
        "INVALID_CREDENTIALS",
        "Rust RCON credentials appear invalid.",
      );
    }
  }

  await recordAttempt({
    serverId: integration.serverId,
    integrationId: integration.id,
    attemptType: "REFRESH",
    success: merged.successful,
    errorCategory: merged.errorCategory,
    durationMs: 0,
    correlationId: randomUUID(),
  });
  return merged;
}
