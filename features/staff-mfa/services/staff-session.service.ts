import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  assessStaffSession,
  elevationExpiry,
  hashElevationToken,
  hashIpForPrivacy,
  newElevationToken,
  sanitizeUserAgent,
  type StaffSessionRow,
} from "@/features/staff-mfa/lib/session-policy";

/** How often lastSeenAt is persisted (avoids a write on every request). */
const TOUCH_INTERVAL_MS = 60 * 1000;

export type CreatedStaffSession = {
  rawToken: string;
  sessionId: string;
  expiresAt: Date;
};

/** Session rotation after MFA: every verification issues a brand-new token. */
export async function createStaffSession(input: {
  userId: string;
  ip: string | null;
  userAgent: string | null;
  nowMs?: number;
}): Promise<CreatedStaffSession> {
  const nowMs = input.nowMs ?? Date.now();
  const token = newElevationToken();
  const row = await prisma.staffSession.create({
    data: {
      tokenHash: token.hash,
      userId: input.userId,
      lastSeenAt: new Date(nowMs),
      lastMfaAt: new Date(nowMs),
      expiresAt: elevationExpiry(nowMs),
      ipHash: hashIpForPrivacy(input.ip),
      userAgent: sanitizeUserAgent(input.userAgent),
    },
  });
  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_SESSION_CREATED,
    targetType: "StaffSession",
    targetId: row.id,
    ipAddress: input.ip,
  });
  return { rawToken: token.raw, sessionId: row.id, expiresAt: row.expiresAt };
}

export type ActiveElevation = {
  session: StaffSessionRow;
  stepUpFresh: boolean;
};

/** Resolve and validate the elevation for a raw cookie token. */
export async function getActiveElevation(
  userId: string,
  rawToken: string,
  nowMs = Date.now(),
): Promise<ActiveElevation | null> {
  const row = await prisma.staffSession.findUnique({
    where: { tokenHash: hashElevationToken(rawToken) },
  });
  if (!row || row.userId !== userId) return null;
  const assessment = assessStaffSession(row, nowMs);
  if (!assessment.ok) return null;
  if (nowMs - row.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
    await prisma.staffSession.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date(nowMs) },
    });
  }
  return { session: row, stepUpFresh: assessment.stepUpFresh };
}

/** Record a fresh MFA verification on an existing elevation (step-up). */
export async function recordStepUp(sessionId: string, nowMs = Date.now()): Promise<void> {
  await prisma.staffSession.update({
    where: { id: sessionId },
    data: { lastMfaAt: new Date(nowMs), lastSeenAt: new Date(nowMs) },
  });
}

export async function revokeStaffSession(input: {
  userId: string;
  sessionId: string;
  reason: string;
  actorUserId?: string;
  ip?: string | null;
}): Promise<boolean> {
  const result = await prisma.staffSession.updateMany({
    where: { id: input.sessionId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: input.reason.slice(0, 64) },
  });
  if (result.count > 0) {
    await writeAuditLog({
      actorUserId: input.actorUserId ?? input.userId,
      action: AuditAction.STAFF_SESSION_REVOKED,
      targetType: "StaffSession",
      targetId: input.sessionId,
      metadata: { reason: input.reason },
      ipAddress: input.ip ?? null,
    });
  }
  return result.count > 0;
}

export async function revokeAllStaffSessions(input: {
  userId: string;
  reason: string;
  exceptSessionId?: string;
  actorUserId?: string;
  ip?: string | null;
}): Promise<number> {
  const result = await prisma.staffSession.updateMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      ...(input.exceptSessionId ? { id: { not: input.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: input.reason.slice(0, 64) },
  });
  if (result.count > 0) {
    await writeAuditLog({
      actorUserId: input.actorUserId ?? input.userId,
      action: AuditAction.STAFF_SESSIONS_REVOKED_ALL,
      targetType: "User",
      targetId: input.userId,
      metadata: { reason: input.reason, count: result.count },
      ipAddress: input.ip ?? null,
    });
  }
  return result.count;
}

export type StaffSessionView = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastMfaAt: string;
  expiresAt: string;
  /** Privacy: short prefix of the IP hash only — never a raw address. */
  ipHint: string | null;
  userAgent: string | null;
};

export async function listStaffSessions(
  userId: string,
  currentRawToken: string | null,
  nowMs = Date.now(),
): Promise<StaffSessionView[]> {
  const currentHash = currentRawToken ? hashElevationToken(currentRawToken) : null;
  const rows = await prisma.staffSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date(nowMs) } },
    orderBy: { lastSeenAt: "desc" },
    take: 30,
  });
  return rows
    .filter((row) => assessStaffSession(row, nowMs).ok)
    .map((row) => ({
      id: row.id,
      current: currentHash !== null && row.tokenHash === currentHash,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      lastMfaAt: row.lastMfaAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ipHint: row.ipHash ? row.ipHash.slice(0, 8) : null,
      userAgent: row.userAgent,
    }));
}
