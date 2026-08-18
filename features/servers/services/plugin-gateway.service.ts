/**
 * Method B: signed webhook/plugin channel (client, 2026-08-18,
 * KOBA-vs-Tip4Serv architecture spec). Unlike RCON (KOBA dials out to
 * the server), this is pull-based — a modded-server plugin (Oxide/
 * Carbon for Rust, Spigot for Minecraft) polls KOBA for pending
 * commands and acks them, since most game servers sit behind NAT and
 * can't accept inbound connections anyway. Every plugin-facing
 * function here authenticates via HMAC (features/servers/lib/
 * plugin-auth.ts), never a session — these are called by a server
 * process, not a browser.
 */
import { prisma } from "@/lib/db";
import { ServerError } from "@/features/servers/lib/errors";
import { generatePluginApiKey, verifyPluginSignature } from "@/features/servers/lib/plugin-auth";
import { applyJobOutcome } from "@/features/payments/services/rcon-queue.service";

const PLUGIN_POLL_BATCH = 10;

async function resolveOwnedServer(ownerUserId: string, serverIdOrSlug: string) {
  const server = await prisma.gameServer.findFirst({
    where: {
      ownerUserId,
      OR: [{ id: serverIdOrSlug }, { slug: serverIdOrSlug }, { publicRef: serverIdOrSlug }],
    },
    select: { id: true, deliveryMethod: true },
  });
  if (!server) {
    throw new ServerError("That server isn't yours.", "NOT_FOUND");
  }
  return server;
}

/** Session-authenticated (seller in their dashboard) — issues a fresh
 * key and returns the plaintext secret exactly once. A prior key, if
 * any, is deleted outright rather than just marked revoked: only one
 * key is ever meaningful per server, and there's nothing worth
 * auditing in a superseded plugin secret the way there is for, say, a
 * revoked OAuth device token. */
export async function rotatePluginApiKey(actorUserId: string, serverIdOrSlug: string) {
  const server = await resolveOwnedServer(actorUserId, serverIdOrSlug);
  const generated = generatePluginApiKey();

  await prisma.serverApiKey.upsert({
    where: { serverId: server.id },
    create: {
      serverId: server.id,
      keyPrefix: generated.keyPrefix,
      ciphertext: generated.sealed.ciphertext,
      iv: generated.sealed.iv,
      authTag: generated.sealed.authTag,
    },
    update: {
      keyPrefix: generated.keyPrefix,
      ciphertext: generated.sealed.ciphertext,
      iv: generated.sealed.iv,
      authTag: generated.sealed.authTag,
      rotatedAt: new Date(),
      revokedAt: null,
    },
  });

  return { secret: generated.secret, keyPrefix: generated.keyPrefix };
}

export async function getPluginKeyStatus(actorUserId: string, serverIdOrSlug: string) {
  const server = await resolveOwnedServer(actorUserId, serverIdOrSlug);
  const key = await prisma.serverApiKey.findUnique({ where: { serverId: server.id } });
  return {
    deliveryMethod: server.deliveryMethod,
    configured: Boolean(key && !key.revokedAt),
    keyPrefix: key?.revokedAt ? null : (key?.keyPrefix ?? null),
    rotatedAt: key?.rotatedAt ?? null,
  };
}

/** HMAC-authenticated (the plugin itself, not a session) — resolves
 * the real server id from whatever the plugin was configured with
 * (id/slug/publicRef, same flexible lookup used everywhere else in
 * this codebase) and verifies the signature against that server's
 * sealed key. Returns null rather than throwing on any failure so
 * every route calling this returns a uniform 401, never leaking which
 * part of the check failed. */
export async function authenticatePluginRequest(input: {
  serverIdOrSlug: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<{ serverId: string } | null> {
  const server = await prisma.gameServer.findFirst({
    where: { OR: [{ id: input.serverIdOrSlug }, { slug: input.serverIdOrSlug }, { publicRef: input.serverIdOrSlug }] },
    select: { id: true },
  });
  if (!server) return null;

  const key = await prisma.serverApiKey.findUnique({ where: { serverId: server.id } });
  if (!key || key.revokedAt) return null;

  const verified = verifyPluginSignature({
    sealed: { ciphertext: key.ciphertext, iv: key.iv, authTag: key.authTag },
    rawBody: input.rawBody,
    header: input.signatureHeader,
  });
  if (!verified) return null;

  return { serverId: server.id };
}

/** Claims (PENDING → RUNNING) and returns up to PLUGIN_POLL_BATCH due
 * jobs for this server — the plugin executes them locally and reports
 * back via ackPluginCommand. Nothing here calls out over RCON; the
 * plugin is the one running the command inside the game server
 * process. */
export async function listPendingCommandsForServer(serverId: string) {
  const now = new Date();
  const jobs = await prisma.rconCommandJob.findMany({
    where: { serverId, status: "PENDING", runAfter: { lte: now } },
    orderBy: { runAfter: "asc" },
    take: PLUGIN_POLL_BATCH,
  });
  if (!jobs.length) return [];

  await prisma.rconCommandJob.updateMany({
    where: { id: { in: jobs.map((job) => job.id) } },
    data: { status: "RUNNING" },
  });

  return jobs.map((job) => ({ jobId: job.id, kitName: job.kitName, gamertag: job.gamertag }));
}

/** The plugin reports what happened when it ran a command locally —
 * this is the only place a plugin's own outcome reaches the queue's
 * state machine, and it reuses the exact same success/retryable/
 * terminal transitions the RCON dial-out path uses
 * (rcon-queue.service#applyJobOutcome), so RETRYING/DEAD/FAILED mean
 * the same thing to a seller regardless of which delivery method
 * produced them. */
export async function ackPluginCommand(
  serverId: string,
  jobId: string,
  outcome: { success: boolean; error?: string },
) {
  const job = await prisma.rconCommandJob.findUnique({ where: { id: jobId } });
  if (!job || job.serverId !== serverId) {
    throw new ServerError("That job isn't for this server.", "NOT_FOUND");
  }

  await applyJobOutcome(
    jobId,
    outcome.success ? "SUCCESS" : "RETRYABLE",
    outcome.error ?? "Plugin reported a failed delivery.",
  );
}
