/**
 * Bounded Rust integration polling — VPS worker only.
 * Never import from page render / RSC paths.
 */
import { prisma } from "@/lib/db";
import { isCredentialEncryptionConfigured } from "@/lib/crypto/credential-box";
import { mapWithConcurrency, withJitter } from "@/features/servers/services/polling.service";
import { runRustRefresh } from "@/features/servers/services/integration.service";

export const INTEGRATION_CONCURRENCY = 4;
export const INTEGRATION_BATCH = 20;

export function integrationWorkerHealth() {
  return {
    ok: isCredentialEncryptionConfigured(),
    service: "koba-rust-integration-worker",
    encryption: isCredentialEncryptionConfigured() ? "configured" : "missing",
    time: new Date().toISOString(),
  };
}

export async function selectDueIntegrations(opts?: { limit?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  return prisma.serverIntegration.findMany({
    where: {
      provider: "RUST_PC",
      status: { in: ["CONNECTED", "DEGRADED", "FAILED"] },
      revokedAt: null,
      disconnectedAt: null,
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }],
    },
    orderBy: [{ nextPollAt: "asc" }, { id: "asc" }],
    take: opts?.limit ?? INTEGRATION_BATCH,
  });
}

export async function claimJobs(opts?: { limit?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const jobs = await prisma.serverIntegrationJob.findMany({
    where: {
      status: "PENDING",
      cancelledAt: null,
      runAfter: { lte: now },
    },
    orderBy: { runAfter: "asc" },
    take: opts?.limit ?? INTEGRATION_BATCH,
  });
  if (!jobs.length) return [];
  await prisma.serverIntegrationJob.updateMany({
    where: { id: { in: jobs.map((job) => job.id) } },
    data: { status: "RUNNING" },
  });
  return jobs;
}

export async function runIntegrationBatch(opts?: { concurrency?: number; limit?: number }) {
  const concurrency = opts?.concurrency ?? INTEGRATION_CONCURRENCY;
  const due = await selectDueIntegrations({ limit: opts?.limit ?? INTEGRATION_BATCH });
  const jobs = await claimJobs({ limit: opts?.limit ?? INTEGRATION_BATCH });

  const integrationIds = new Set<string>();
  for (const row of due) integrationIds.add(row.id);
  for (const job of jobs) {
    if (job.integrationId) integrationIds.add(job.integrationId);
  }

  const results = await mapWithConcurrency([...integrationIds], concurrency, async (id) => {
    try {
      const result = await runRustRefresh(id);
      return {
        integrationId: id,
        successful: result.successful,
        errorCategory: result.errorCategory,
      };
    } catch {
      return { integrationId: id, successful: false, errorCategory: "INTERNAL_CONFIGURATION" };
    }
  });

  const now = new Date();
  for (const job of jobs) {
    const match = results.find((row) => row.integrationId === job.integrationId);
    await prisma.serverIntegrationJob.update({
      where: { id: job.id },
      data: {
        status: match?.successful ? "SUCCEEDED" : "FAILED",
        attempts: { increment: 1 },
        lastErrorCategory: match?.errorCategory ?? null,
        runAfter: new Date(now.getTime() + withJitter(60_000)),
      },
    });
  }

  const stale = await prisma.serverIntegration.findMany({
    where: {
      status: { in: ["CONNECTED", "DEGRADED"] },
      lastSuccessfulAt: { lt: new Date(now.getTime() - 30 * 60_000) },
    },
    include: { server: { select: { ownerUserId: true } } },
    take: 20,
  });
  for (const row of stale) {
    const recent = await prisma.serverOwnerNotice.findFirst({
      where: {
        serverId: row.serverId,
        type: "STALE",
        createdAt: { gt: new Date(now.getTime() - 6 * 60 * 60_000) },
      },
    });
    if (!recent) {
      await prisma.serverOwnerNotice.create({
        data: {
          serverId: row.serverId,
          ownerUserId: row.server.ownerUserId,
          type: "STALE",
          message: "Rust integration status is stale.",
        },
      });
    }
  }

  return {
    selected: integrationIds.size,
    succeeded: results.filter((row) => row.successful).length,
    failed: results.filter((row) => !row.successful).length,
    jobs: jobs.length,
    encryption: isCredentialEncryptionConfigured(),
  };
}
