import { createHash } from "node:crypto";
import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = {
  actorUserId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

type AuditHashableRecord = {
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
};

// Fixed, arbitrary key for a Postgres session-level advisory lock. Every
// writeAuditLog() call takes this lock for the duration of its transaction
// so "read latest hash, then write the next link" can't race — without it,
// two concurrent writes could both read the same prevHash and silently fork
// the chain instead of extending it.
const AUDIT_CHAIN_LOCK_KEY = 7_272_727;

/**
 * Computes the tamper-evident hash for one AuditLog row: a SHA-256 commit
 * over the row's own fields chained onto the previous row's hash. Changing
 * or deleting any past row breaks every hash after it, so a chain replay
 * (see verifyAuditChain) detects tampering anywhere in the log.
 *
 * Exported so verifyAuditChain can recompute and compare without
 * duplicating the canonicalization logic.
 */
export function computeAuditHash(prevHash: string | null, record: AuditHashableRecord): string {
  const canonical = JSON.stringify({
    actorUserId: record.actorUserId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    metadata: record.metadata ?? null,
    ipAddress: record.ipAddress,
    createdAt: record.createdAt,
  });
  return createHash("sha256")
    .update(`${prevHash ?? "GENESIS"}:${canonical}`)
    .digest("hex");
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const createdAt = new Date();
  const actorUserId = input.actorUserId ?? null;
  const targetType = input.targetType ?? null;
  const targetId = input.targetId ?? null;
  const ipAddress = input.ipAddress ?? null;
  const metadata = input.metadata ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`;

    const previous = await tx.auditLog.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { hash: true },
    });
    const prevHash = previous?.hash ?? null;
    const hash = computeAuditHash(prevHash, {
      actorUserId,
      action: input.action,
      targetType,
      targetId,
      metadata,
      ipAddress,
      createdAt: createdAt.toISOString(),
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: input.action,
        targetType,
        targetId,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ipAddress,
        createdAt,
        prevHash,
        hash,
      },
    });
  });
}

export type AuditChainVerification = {
  valid: boolean;
  checked: number;
  /** id of the first row whose stored hash doesn't match its recomputed hash, if any. */
  brokenAtId: string | null;
};

/**
 * Replays the audit log in chain order and recomputes each row's hash to
 * confirm nothing was altered or deleted after the fact. Rows written
 * before hash chaining shipped have prevHash/hash = null and are skipped
 * (the chain is treated as starting fresh at the first non-null row).
 */
export async function verifyAuditChain(limit = 5000): Promise<AuditChainVerification> {
  const rows = await prisma.auditLog.findMany({
    where: { hash: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let expectedPrevHash: string | null = null;
  let checked = 0;
  for (const row of rows) {
    if (row.prevHash !== expectedPrevHash) {
      return { valid: false, checked, brokenAtId: row.id };
    }
    const recomputed = computeAuditHash(expectedPrevHash, {
      actorUserId: row.actorUserId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    });
    if (recomputed !== row.hash) {
      return { valid: false, checked, brokenAtId: row.id };
    }
    expectedPrevHash = row.hash;
    checked += 1;
  }

  return { valid: true, checked, brokenAtId: null };
}
