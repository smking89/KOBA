/**
 * Durable command delivery queue — VPS worker only for the retry
 * batch, but the first-attempt execution path is also called inline
 * from a webhook request (deliverRconKitForOrder), so keep this
 * side-effect boundary explicit rather than folding it into
 * rcon-delivery.service.ts.
 *
 * Client, 2026-08-18 (KOBA-vs-Tip4Serv architecture spec): "if a target
 * game server is offline, down, or experiencing lag, the KOBA gateway
 * must cache the commands in a database queue and safely retry
 * execution using an exponential backoff strategy until success is
 * confirmed." This replaces the earlier fire-once/manual-retry-only
 * RCON delivery (same day, ab0bb93) with real automatic retry, while
 * keeping that manual seller retry as the escape hatch once the
 * automatic budget is exhausted (DEAD).
 *
 * A job's parent is either an Order (one-time RCON-delivery purchase)
 * or a ProductSubscription (recurring VIP grant/expiry) — never both;
 * enqueueRconJob's input type enforces that at the call site.
 * Delivery method is per-server, not per-job: RCON servers get an
 * inline dial-out attempt via executeRconJob and, on transient
 * failure, retried by this queue's worker; PLUGIN_API servers never
 * get dialed by KOBA at all — the job just sits PENDING until the
 * seller's plugin polls it via features/servers/services/
 * plugin-gateway.service.ts and reports back through the exact same
 * applyJobOutcome state machine.
 */
import { prisma } from "@/lib/db";
import { newCorrelationId } from "@/lib/observability/request-id";
import { withJitter } from "@/features/servers/services/polling.service";
import { giveKitToPlayer } from "@/features/servers/services/server.service";
import type { RconTestState } from "@/lib/generated/prisma/client";

export const RCON_JOB_BASE_INTERVAL_MS = 30_000; // 30s
export const RCON_JOB_MAX_INTERVAL_MS = 15 * 60_000; // 15m cap per attempt
export const RCON_JOB_MAX_ATTEMPTS = 8; // ~1h total budget before DEAD

const STATE_ERROR_MESSAGE: Record<string, string> = {
  UNSUPPORTED: "This server doesn't support RCON delivery (missing host/port/credentials).",
  AUTH_FAILED: "RCON authentication failed — check the server's stored RCON password.",
};

/** Only TIMEOUT is treated as transient (server offline/laggy) and
 * queued for backoff retry. AUTH_FAILED/UNSUPPORTED are config
 * problems a retry loop can never fix on its own — those go straight
 * to FAILED so the seller knows to act, not DEAD after wasting an
 * hour of retries on a password that was always wrong. */
const RETRYABLE_STATES = new Set(["TIMEOUT"]);

export function computeRconBackoffMs(attempts: number): number {
  const exp = RCON_JOB_BASE_INTERVAL_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(exp, RCON_JOB_MAX_INTERVAL_MS);
}

type JobParent = { orderId: string; productSubscriptionId?: never } | { productSubscriptionId: string; orderId?: never };

/** Create the job row for a freshly-paid order, a seller-triggered
 * redeliver, or a subscription grant/expiry. Does not execute it —
 * RCON-channel callers execute the first attempt inline immediately
 * after, for the instant-delivery feel the happy path (server online)
 * should still have; PLUGIN_API-channel callers leave it PENDING for
 * the plugin to pull. */
export async function enqueueRconJob(
  input: JobParent & { serverId: string; kitName: string; gamertag: string },
) {
  return prisma.rconCommandJob.create({
    data: {
      orderId: input.orderId ?? null,
      productSubscriptionId: input.productSubscriptionId ?? null,
      serverId: input.serverId,
      kitName: input.kitName,
      gamertag: input.gamertag,
      correlationId: newCorrelationId(),
    },
  });
}

/** True for a server whose delivery method is RCON — the only kind
 * that should ever be executed inline/by this worker. Callers check
 * this before deciding whether to call executeRconJob at all;
 * PLUGIN_API jobs are left PENDING for the plugin gateway instead. */
export async function shouldDialRcon(serverId: string): Promise<boolean> {
  const server = await prisma.gameServer.findUnique({
    where: { id: serverId },
    select: { deliveryMethod: true },
  });
  return server?.deliveryMethod === "RCON";
}

/** The single state-transition function every delivery path funnels
 * through — the RCON dial-out attempt below, and the Method B plugin's
 * ack of a command it ran itself (features/servers/services/
 * plugin-gateway.service.ts#ackPluginCommand). Whichever produced the
 * outcome, SUCCESS/RETRYABLE/TERMINAL mean the same thing to a seller. */
export async function applyJobOutcome(
  jobId: string,
  outcome: "SUCCESS" | "RETRYABLE" | "TERMINAL",
  message?: string,
): Promise<"SUCCEEDED" | "RETRYING" | "FAILED" | "DEAD"> {
  const job = await prisma.rconCommandJob.findUnique({ where: { id: jobId } });
  if (!job) return "FAILED";

  if (outcome === "SUCCESS") {
    await prisma.rconCommandJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED" } });
    if (job.orderId) {
      await prisma.order.update({
        where: { id: job.orderId },
        data: { rconDeliveryStatus: "DELIVERED", rconDeliveryError: null },
      });
    }
    return "SUCCEEDED";
  }

  if (outcome === "TERMINAL") {
    const errorMessage = message ?? "Delivery failed.";
    await prisma.rconCommandJob.update({
      where: { id: job.id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: errorMessage },
    });
    if (job.orderId) {
      await prisma.order.update({
        where: { id: job.orderId },
        data: { rconDeliveryStatus: "FAILED", rconDeliveryError: errorMessage },
      });
    }
    return "FAILED";
  }

  return handleTransientFailure(job.id, job.attempts, job.orderId, message ?? "The server didn't respond in time.");
}

/** Execute one job attempt over RCON and translate the result into
 * applyJobOutcome's vocabulary. Only ever called for a server whose
 * deliveryMethod is RCON — callers must check shouldDialRcon first. */
export async function executeRconJob(
  jobId: string,
): Promise<"SUCCEEDED" | "RETRYING" | "FAILED" | "DEAD"> {
  const job = await prisma.rconCommandJob.findUnique({
    where: { id: jobId },
    include: {
      order: { include: { shop: { select: { ownerUserId: true } } } },
      productSubscription: { include: { shop: { select: { ownerUserId: true } } } },
    },
  });
  if (!job) return "FAILED";

  const ownerUserId = job.order?.shop.ownerUserId ?? job.productSubscription?.shop.ownerUserId;
  if (!ownerUserId) return "FAILED";

  await prisma.rconCommandJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });

  let state: RconTestState;
  try {
    const result = await giveKitToPlayer(ownerUserId, job.serverId, job.kitName, job.gamertag, null);
    state = result.state;
  } catch (error) {
    // Unexpected exceptions (network blip, unhandled adapter error)
    // are treated the same as TIMEOUT — transient, worth retrying —
    // rather than silently going terminal on something that might
    // just be a bad moment.
    return applyJobOutcome(
      job.id,
      "RETRYABLE",
      error instanceof Error ? error.message : "Unknown delivery error.",
    );
  }

  if (state === "SUCCESS") {
    return applyJobOutcome(job.id, "SUCCESS");
  }
  if (RETRYABLE_STATES.has(state)) {
    return applyJobOutcome(job.id, "RETRYABLE", "The server didn't respond in time.");
  }
  // Non-retryable: AUTH_FAILED / UNSUPPORTED / IDLE (shouldn't happen
  // for a configured RCON product, but never leave a job stuck RUNNING).
  return applyJobOutcome(job.id, "TERMINAL", STATE_ERROR_MESSAGE[state] ?? `Delivery failed (${state}).`);
}

async function handleTransientFailure(
  jobId: string,
  previousAttempts: number,
  orderId: string | null,
  reason: string,
) {
  const attempts = previousAttempts + 1;
  if (attempts >= RCON_JOB_MAX_ATTEMPTS) {
    const message = `Server unreachable after ${attempts} attempts over about an hour — retry manually once it's back online.`;
    await prisma.rconCommandJob.update({
      where: { id: jobId },
      data: { status: "DEAD", attempts, lastError: message },
    });
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { rconDeliveryStatus: "DEAD", rconDeliveryError: message },
      });
    }
    return "DEAD" as const;
  }

  const delayMs = withJitter(computeRconBackoffMs(attempts));
  const message = `Server didn't respond — retrying automatically (attempt ${attempts}/${RCON_JOB_MAX_ATTEMPTS}). ${reason}`;
  await prisma.rconCommandJob.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts, runAfter: new Date(Date.now() + delayMs), lastError: message },
  });
  if (orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { rconDeliveryStatus: "RETRYING", rconDeliveryError: message },
    });
  }
  return "RETRYING" as const;
}

/** Batch entrypoint for scripts/run-rcon-delivery-worker.mjs. Claims
 * due PENDING jobs (runAfter <= now) belonging to RCON-channel servers
 * only — PLUGIN_API jobs are never dialed by KOBA, they wait for the
 * plugin's own poll (features/servers/services/plugin-gateway.service.ts). */
export async function runRconDeliveryWorker(limit = 20) {
  const now = new Date();
  const due = await prisma.rconCommandJob.findMany({
    where: { status: "PENDING", runAfter: { lte: now }, server: { deliveryMethod: "RCON" } },
    orderBy: { runAfter: "asc" },
    take: limit,
  });

  let succeeded = 0;
  let failed = 0;
  for (const job of due) {
    const outcome = await executeRconJob(job.id);
    if (outcome === "SUCCEEDED") succeeded += 1;
    else if (outcome === "FAILED" || outcome === "DEAD") failed += 1;
  }

  const queueDepth = await prisma.rconCommandJob.count({
    where: { status: "PENDING", server: { deliveryMethod: "RCON" } },
  });
  const oldestPending = await prisma.rconCommandJob.findFirst({
    where: { status: "PENDING", server: { deliveryMethod: "RCON" } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return {
    claimed: due.length,
    succeeded,
    failed,
    queueDepth,
    oldestJobAgeMs: oldestPending ? now.getTime() - oldestPending.createdAt.getTime() : 0,
  };
}
