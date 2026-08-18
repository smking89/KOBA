/**
 * Durable RCON delivery queue — VPS worker only for the retry batch,
 * but the first-attempt execution path is also called inline from a
 * webhook request (deliverRconKitForOrder), so keep this side-effect
 * boundary explicit rather than folding it into rcon-delivery.service.ts.
 *
 * Client, 2026-08-18 (KOBA-vs-Tip4Serv architecture spec): "if a target
 * game server is offline, down, or experiencing lag, the KOBA gateway
 * must cache the commands in a database queue and safely retry
 * execution using an exponential backoff strategy until success is
 * confirmed." This replaces the earlier fire-once/manual-retry-only
 * RCON delivery (same day, ab0bb93) with real automatic retry, while
 * keeping that manual seller retry as the escape hatch once the
 * automatic budget is exhausted (DEAD).
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

/** Create the job row for a freshly-paid (or seller-redelivered) order.
 * Does not execute it — callers execute the first attempt inline
 * immediately after, for the instant-delivery feel the happy path
 * (server online) should still have. */
export async function enqueueRconJob(input: {
  orderId: string;
  serverId: string;
  kitName: string;
  gamertag: string;
}) {
  return prisma.rconCommandJob.create({
    data: {
      orderId: input.orderId,
      serverId: input.serverId,
      kitName: input.kitName,
      gamertag: input.gamertag,
      correlationId: newCorrelationId(),
    },
  });
}

/** Execute one job attempt and transition both the job and its order
 * to the resulting state. Shared by the inline first-attempt call and
 * the background worker's retry batch — the only place that actually
 * calls giveKitToPlayer for queued delivery. */
export async function executeRconJob(jobId: string): Promise<
  "SUCCEEDED" | "RETRYING" | "FAILED" | "DEAD"
> {
  const job = await prisma.rconCommandJob.findUnique({
    where: { id: jobId },
    include: { order: { include: { shop: { select: { ownerUserId: true } } } } },
  });
  if (!job) return "FAILED";

  await prisma.rconCommandJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });

  let state: RconTestState;
  try {
    const result = await giveKitToPlayer(
      job.order.shop.ownerUserId,
      job.serverId,
      job.kitName,
      job.gamertag,
      null,
    );
    state = result.state;
  } catch (error) {
    // Unexpected exceptions (network blip, unhandled adapter error)
    // are treated the same as TIMEOUT — transient, worth retrying —
    // rather than silently going terminal on something that might
    // just be a bad moment.
    return handleTransientFailure(job.id, job.attempts, error instanceof Error ? error.message : "Unknown delivery error.");
  }

  if (state === "SUCCESS") {
    await prisma.$transaction([
      prisma.rconCommandJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED" } }),
      prisma.order.update({
        where: { id: job.orderId },
        data: { rconDeliveryStatus: "DELIVERED", rconDeliveryError: null },
      }),
    ]);
    return "SUCCEEDED";
  }

  if (RETRYABLE_STATES.has(state)) {
    return handleTransientFailure(job.id, job.attempts, "The server didn't respond in time.");
  }

  // Non-retryable: AUTH_FAILED / UNSUPPORTED / IDLE (shouldn't happen
  // for a configured RCON product, but never leave a job stuck RUNNING).
  const message = STATE_ERROR_MESSAGE[state] ?? `Delivery failed (${state}).`;
  await prisma.$transaction([
    prisma.rconCommandJob.update({
      where: { id: job.id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: message },
    }),
    prisma.order.update({
      where: { id: job.orderId },
      data: { rconDeliveryStatus: "FAILED", rconDeliveryError: message },
    }),
  ]);
  return "FAILED";
}

async function handleTransientFailure(jobId: string, previousAttempts: number, reason: string) {
  const attempts = previousAttempts + 1;
  if (attempts >= RCON_JOB_MAX_ATTEMPTS) {
    const message = `Server unreachable after ${attempts} attempts over about an hour — retry manually once it's back online.`;
    const job = await prisma.rconCommandJob.update({
      where: { id: jobId },
      data: { status: "DEAD", attempts, lastError: message },
    });
    await prisma.order.update({
      where: { id: job.orderId },
      data: { rconDeliveryStatus: "DEAD", rconDeliveryError: message },
    });
    return "DEAD" as const;
  }

  const delayMs = withJitter(computeRconBackoffMs(attempts));
  const message = `Server didn't respond — retrying automatically (attempt ${attempts}/${RCON_JOB_MAX_ATTEMPTS}). ${reason}`;
  const job = await prisma.rconCommandJob.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts, runAfter: new Date(Date.now() + delayMs), lastError: message },
  });
  await prisma.order.update({
    where: { id: job.orderId },
    data: { rconDeliveryStatus: "RETRYING", rconDeliveryError: message },
  });
  return "RETRYING" as const;
}

/** Batch entrypoint for scripts/run-rcon-delivery-worker.mjs. Claims
 * due PENDING jobs (runAfter <= now) and executes each — the only
 * thing that ever advances a job past its first, inline attempt. */
export async function runRconDeliveryWorker(limit = 20) {
  const now = new Date();
  const due = await prisma.rconCommandJob.findMany({
    where: { status: "PENDING", runAfter: { lte: now } },
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

  const queueDepth = await prisma.rconCommandJob.count({ where: { status: "PENDING" } });
  const oldestPending = await prisma.rconCommandJob.findFirst({
    where: { status: "PENDING" },
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
