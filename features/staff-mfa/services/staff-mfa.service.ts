import bcrypt from "bcryptjs";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getPublicEnv } from "@/lib/env";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import {
  isStaffMfaEncryptionConfigured,
  openTotpSecret,
  sealTotpSecret,
} from "@/lib/crypto/staff-mfa-box";
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from "@/lib/crypto/totp";
import { totpQrDataUrl } from "@/features/staff-mfa/lib/qr";
import {
  CHALLENGE_PURPOSE,
  ENROLLMENT_TTL_MS,
  MFA_CHALLENGE_MAX_ATTEMPTS,
  MFA_CHALLENGE_TTL_MS,
  MFA_TICKET_TTL_MS,
  RECOVERY_CODE_COUNT,
} from "@/features/staff-mfa/lib/config";
import { StaffMfaError } from "@/features/staff-mfa/lib/errors";
import { notifyStaffSecurity } from "@/features/staff-mfa/lib/notifications";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  recoveryHashesEqual,
} from "@/features/staff-mfa/lib/recovery-codes";
import { hashChallengeToken, newChallengeToken } from "@/features/staff-mfa/lib/session-policy";
import { loadStaffTypes, userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import {
  createStaffSession,
  recordStepUp,
  revokeAllStaffSessions,
  type CreatedStaffSession,
} from "@/features/staff-mfa/services/staff-session.service";

const GENERIC_CODE_ERROR = "Invalid authentication code.";

async function requireStaffUser(userId: string) {
  if (!(await userHasStaffIdentity(userId))) {
    throw new StaffMfaError("Staff only.", "FORBIDDEN");
  }
}

async function confirmAccountPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    throw new StaffMfaError("Password confirmation failed.", "FORBIDDEN");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new StaffMfaError("Password confirmation failed.", "FORBIDDEN");
  }
}

async function loadActiveFactor(userId: string) {
  const factor = await prisma.staffMfaFactor.findUnique({
    where: { userId },
    include: { recoveryCodes: true },
  });
  if (!factor || factor.status !== "ACTIVE") {
    throw new StaffMfaError("Staff MFA is not enabled.", "MFA_ENROLLMENT_REQUIRED");
  }
  return factor;
}

function lastAcceptedStepNumber(value: bigint | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

async function verifyTotpAgainstFactor(
  factor: {
    id: string;
    userId: string;
    secretCiphertext: string;
    secretIv: string;
    secretAuthTag: string;
    keyVersion: number;
    lastAcceptedStep: bigint | number | null;
  },
  code: string,
  nowMs: number,
): Promise<{ step: number }> {
  const secret = openTotpSecret(
    {
      ciphertext: factor.secretCiphertext,
      iv: factor.secretIv,
      authTag: factor.secretAuthTag,
      keyVersion: factor.keyVersion,
    },
    factor.userId,
  );
  const result = verifyTotp(secret, code, {
    nowMs,
    minStepExclusive: lastAcceptedStepNumber(factor.lastAcceptedStep),
  });
  if (!result.ok) {
    return Promise.reject(new StaffMfaError(GENERIC_CODE_ERROR, "INVALID"));
  }
  await prisma.staffMfaFactor.update({
    where: { id: factor.id },
    data: { lastAcceptedStep: BigInt(result.step) },
  });
  return { step: result.step };
}

async function consumeRecoveryCode(factorId: string, submitted: string): Promise<boolean> {
  const unused = await prisma.staffRecoveryCode.findMany({
    where: { factorId, usedAt: null },
  });
  const submittedHash = hashRecoveryCode(submitted);
  const match = unused.find((row) => recoveryHashesEqual(row.codeHash, submittedHash));
  if (!match) return false;
  const consumed = await prisma.staffRecoveryCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

async function replaceRecoveryCodes(factorId: string): Promise<string[]> {
  const plaintext = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.$transaction([
    prisma.staffRecoveryCode.deleteMany({ where: { factorId } }),
    prisma.staffRecoveryCode.createMany({
      data: plaintext.map((code) => ({ factorId, codeHash: hashRecoveryCode(code) })),
    }),
  ]);
  return plaintext;
}

export async function getStaffMfaStatus(userId: string) {
  await requireStaffUser(userId);
  const factor = await prisma.staffMfaFactor.findUnique({
    where: { userId },
    include: { recoveryCodes: { select: { usedAt: true } } },
  });
  const remaining = factor?.recoveryCodes.filter((row) => !row.usedAt).length ?? 0;
  return {
    enrolled: factor?.status === "ACTIVE",
    pendingEnrollment: factor?.status === "PENDING",
    remainingRecoveryCodes: factor?.status === "ACTIVE" ? remaining : 0,
    confirmedAt: factor?.confirmedAt?.toISOString() ?? null,
  };
}

export async function startEnrollment(input: {
  userId: string;
  password: string;
  ip?: string | null;
  nowMs?: number;
}) {
  await requireStaffUser(input.userId);
  if (!isStaffMfaEncryptionConfigured()) {
    throw new StaffMfaError("Staff MFA encryption is not configured.", "NOT_CONFIGURED");
  }
  await confirmAccountPassword(input.userId, input.password);

  const existing = await prisma.staffMfaFactor.findUnique({ where: { userId: input.userId } });
  if (existing?.status === "ACTIVE") {
    throw new StaffMfaError("MFA is already enabled.", "INVALID");
  }

  const nowMs = input.nowMs ?? Date.now();
  const secret = generateTotpSecret();
  const sealed = sealTotpSecret(secret, input.userId);
  const expiresAt = new Date(nowMs + ENROLLMENT_TTL_MS);

  const factor = await prisma.staffMfaFactor.upsert({
    where: { userId: input.userId },
    update: {
      status: "PENDING",
      secretCiphertext: sealed.ciphertext,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
      lastAcceptedStep: null,
      enrollmentExpiresAt: expiresAt,
      confirmedAt: null,
    },
    create: {
      userId: input.userId,
      status: "PENDING",
      secretCiphertext: sealed.ciphertext,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
      enrollmentExpiresAt: expiresAt,
    },
  });

  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_MFA_ENROLLMENT_STARTED,
    targetType: "StaffMfaFactor",
    targetId: factor.id,
    ipAddress: input.ip ?? null,
  });

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  const otpauth = buildOtpauthUri({
    issuer: getPublicEnv().appName,
    accountName: user?.email ?? "staff",
    secret,
  });
  const qrDataUrl = await totpQrDataUrl(otpauth);
  return {
    factorId: factor.id,
    otpauth,
    secret,
    qrDataUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function confirmEnrollment(input: {
  userId: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
  nowMs?: number;
}): Promise<{ recoveryCodes: string[]; session: CreatedStaffSession }> {
  await requireStaffUser(input.userId);
  const nowMs = input.nowMs ?? Date.now();
  const factor = await prisma.staffMfaFactor.findUnique({ where: { userId: input.userId } });
  if (!factor || factor.status !== "PENDING") {
    throw new StaffMfaError("No MFA enrollment in progress.", "INVALID");
  }
  if (!factor.enrollmentExpiresAt || factor.enrollmentExpiresAt.getTime() <= nowMs) {
    throw new StaffMfaError("Enrollment expired. Start again.", "INVALID");
  }

  try {
    await verifyTotpAgainstFactor(factor, input.code, nowMs);
  } catch (error) {
    await writeAuditLog({
      actorUserId: input.userId,
      action: AuditAction.STAFF_MFA_CHALLENGE_FAILED,
      targetType: "StaffMfaFactor",
      targetId: factor.id,
      metadata: { purpose: "enroll" },
      ipAddress: input.ip ?? null,
    });
    throw error;
  }

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.$transaction([
    prisma.staffRecoveryCode.deleteMany({ where: { factorId: factor.id } }),
    prisma.staffRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        factorId: factor.id,
        codeHash: hashRecoveryCode(code),
      })),
    }),
    prisma.staffMfaFactor.update({
      where: { id: factor.id },
      data: {
        status: "ACTIVE",
        confirmedAt: new Date(nowMs),
        enrollmentExpiresAt: null,
      },
    }),
  ]);

  await revokeAllStaffSessions({
    userId: input.userId,
    reason: "mfa-enrolled",
    ip: input.ip ?? null,
  });
  const session = await createStaffSession({
    userId: input.userId,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    nowMs,
  });

  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_MFA_ENROLLED,
    targetType: "StaffMfaFactor",
    targetId: factor.id,
    ipAddress: input.ip ?? null,
  });

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  await notifyStaffSecurity(user?.email, "KOBA staff MFA enabled", [
    "Authenticator MFA is now required for KOBA staff access.",
    "Recovery codes were generated. Store them offline — they will not be shown again.",
  ]);

  return { recoveryCodes, session };
}

export async function createMfaChallenge(input: {
  userId: string;
  purpose: typeof CHALLENGE_PURPOSE.login | typeof CHALLENGE_PURPOSE.reauth;
  ip?: string | null;
  nowMs?: number;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  await requireStaffUser(input.userId);
  await loadActiveFactor(input.userId);
  const nowMs = input.nowMs ?? Date.now();
  const token = newChallengeToken();
  const expiresAt = new Date(nowMs + MFA_CHALLENGE_TTL_MS);
  await prisma.staffMfaChallenge.create({
    data: {
      tokenHash: token.hash,
      userId: input.userId,
      purpose: input.purpose,
      expiresAt,
    },
  });
  return { rawToken: token.raw, expiresAt };
}

async function loadOpenChallenge(rawToken: string, nowMs: number) {
  const row = await prisma.staffMfaChallenge.findUnique({
    where: { tokenHash: hashChallengeToken(rawToken) },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() <= nowMs) {
    throw new StaffMfaError("MFA challenge expired. Sign in again.", "INVALID");
  }
  if (row.purpose === CHALLENGE_PURPOSE.sessionIssue) {
    throw new StaffMfaError("MFA challenge expired. Sign in again.", "INVALID");
  }
  if (row.attempts >= MFA_CHALLENGE_MAX_ATTEMPTS) {
    await prisma.staffMfaChallenge.update({
      where: { id: row.id },
      data: { consumedAt: new Date(nowMs) },
    });
    throw new StaffMfaError("Too many attempts. Sign in again.", "RATE_LIMITED");
  }
  return row;
}

async function issueSessionTicket(userId: string, nowMs: number): Promise<string> {
  const token = newChallengeToken();
  await prisma.staffMfaChallenge.create({
    data: {
      tokenHash: token.hash,
      userId,
      purpose: CHALLENGE_PURPOSE.sessionIssue,
      expiresAt: new Date(nowMs + MFA_TICKET_TTL_MS),
    },
  });
  return token.raw;
}

export async function verifyMfaChallenge(input: {
  rawToken: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
  nowMs?: number;
}): Promise<{
  userId: string;
  mfaTicket: string;
  session: CreatedStaffSession;
  recoveryUsed: boolean;
}> {
  const nowMs = input.nowMs ?? Date.now();
  const challenge = await loadOpenChallenge(input.rawToken, nowMs);
  const factor = await loadActiveFactor(challenge.userId);
  let recoveryUsed = false;

  try {
    if (looksLikeRecoveryCode(input.code)) {
      const consumed = await consumeRecoveryCode(factor.id, input.code);
      if (!consumed) {
        throw new StaffMfaError(GENERIC_CODE_ERROR, "INVALID");
      }
      recoveryUsed = true;
    } else {
      await verifyTotpAgainstFactor(factor, input.code, nowMs);
    }
  } catch (error) {
    await prisma.staffMfaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    await writeAuditLog({
      actorUserId: challenge.userId,
      action: AuditAction.STAFF_MFA_CHALLENGE_FAILED,
      targetType: "StaffMfaChallenge",
      targetId: challenge.id,
      metadata: { purpose: challenge.purpose },
      ipAddress: input.ip ?? null,
    });
    throw error;
  }

  await prisma.staffMfaChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date(nowMs) },
  });

  await revokeAllStaffSessions({
    userId: challenge.userId,
    reason: "mfa-login",
    ip: input.ip ?? null,
  });
  const session = await createStaffSession({
    userId: challenge.userId,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    nowMs,
  });
  const mfaTicket = await issueSessionTicket(challenge.userId, nowMs);

  await writeAuditLog({
    actorUserId: challenge.userId,
    action: recoveryUsed
      ? AuditAction.STAFF_MFA_RECOVERY_CODE_USED
      : AuditAction.STAFF_MFA_CHALLENGE_SUCCEEDED,
    targetType: "StaffMfaChallenge",
    targetId: challenge.id,
    metadata: { purpose: challenge.purpose, recoveryUsed },
    ipAddress: input.ip ?? null,
  });

  if (recoveryUsed) {
    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { email: true },
    });
    await notifyStaffSecurity(user?.email, "KOBA staff recovery code used", [
      "A staff recovery code was used to complete multi-factor authentication.",
      "If this was not you, contact a Superadmin immediately. Remaining codes still work until regenerated.",
    ]);
  }

  return { userId: challenge.userId, mfaTicket, session, recoveryUsed };
}

export async function consumeSessionTicket(
  rawTicket: string,
  nowMs = Date.now(),
): Promise<string | null> {
  const row = await prisma.staffMfaChallenge.findUnique({
    where: { tokenHash: hashChallengeToken(rawTicket) },
  });
  if (
    !row ||
    row.purpose !== CHALLENGE_PURPOSE.sessionIssue ||
    row.consumedAt ||
    row.expiresAt.getTime() <= nowMs
  ) {
    return null;
  }
  const consumed = await prisma.staffMfaChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date(nowMs) },
  });
  if (consumed.count !== 1) return null;
  return row.userId;
}

export async function verifyStepUp(input: {
  userId: string;
  sessionId: string;
  code: string;
  ip?: string | null;
  nowMs?: number;
}): Promise<void> {
  const nowMs = input.nowMs ?? Date.now();
  const factor = await loadActiveFactor(input.userId);
  try {
    await verifyTotpAgainstFactor(factor, input.code, nowMs);
  } catch (error) {
    await writeAuditLog({
      actorUserId: input.userId,
      action: AuditAction.STAFF_STEP_UP_FAILED,
      targetType: "StaffMfaFactor",
      targetId: factor.id,
      ipAddress: input.ip ?? null,
    });
    throw error;
  }
  await recordStepUp(input.sessionId, nowMs);
  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_STEP_UP_SUCCEEDED,
    targetType: "StaffSession",
    targetId: input.sessionId,
    ipAddress: input.ip ?? null,
  });
}

export async function regenerateRecoveryCodesForUser(input: {
  userId: string;
  password: string;
  code: string;
  ip?: string | null;
  nowMs?: number;
}): Promise<string[]> {
  await confirmAccountPassword(input.userId, input.password);
  const factor = await loadActiveFactor(input.userId);
  const nowMs = input.nowMs ?? Date.now();
  await verifyTotpAgainstFactor(factor, input.code, nowMs);
  const codes = await replaceRecoveryCodes(factor.id);
  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_MFA_RECOVERY_CODES_REGENERATED,
    targetType: "StaffMfaFactor",
    targetId: factor.id,
    ipAddress: input.ip ?? null,
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  await notifyStaffSecurity(user?.email, "KOBA staff recovery codes regenerated", [
    "Your previous staff recovery codes were invalidated.",
    "New codes were displayed once in the staff security page.",
  ]);
  return codes;
}

export async function disableStaffMfa(input: {
  userId: string;
  password: string;
  code: string;
  ip?: string | null;
  nowMs?: number;
}): Promise<void> {
  await confirmAccountPassword(input.userId, input.password);
  const factor = await loadActiveFactor(input.userId);
  const nowMs = input.nowMs ?? Date.now();
  if (looksLikeRecoveryCode(input.code)) {
    const consumed = await consumeRecoveryCode(factor.id, input.code);
    if (!consumed) throw new StaffMfaError(GENERIC_CODE_ERROR, "INVALID");
  } else {
    await verifyTotpAgainstFactor(factor, input.code, nowMs);
  }
  await prisma.staffMfaFactor.delete({ where: { id: factor.id } });
  await revokeAllStaffSessions({
    userId: input.userId,
    reason: "mfa-disabled",
    ip: input.ip ?? null,
  });
  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_MFA_DISABLED,
    targetType: "StaffMfaFactor",
    targetId: factor.id,
    ipAddress: input.ip ?? null,
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  await notifyStaffSecurity(user?.email, "KOBA staff MFA disabled", [
    "Authenticator MFA was disabled on your staff account.",
    "You must enroll again before accessing staff tools.",
  ]);
}

export async function adminResetStaffMfa(input: {
  actorUserId: string;
  targetEmail: string;
  reason: string;
  ip?: string | null;
}): Promise<void> {
  const actorTypes = await loadStaffTypes(input.actorUserId);
  if (!actorTypes.includes("SUPERADMIN")) {
    throw new StaffMfaError("Only a Superadmin can reset staff MFA.", "FORBIDDEN");
  }
  const target = await prisma.user.findUnique({
    where: { email: input.targetEmail.toLowerCase() },
    include: { kobaIdentities: { select: { accountType: true } }, staffMfaFactor: true },
  });
  if (!target || !target.kobaIdentities.some((row) => isStaffAccountType(row.accountType))) {
    throw new StaffMfaError("Staff account not found.", "FORBIDDEN");
  }
  if (target.id === input.actorUserId) {
    throw new StaffMfaError("You cannot reset your own MFA.", "FORBIDDEN");
  }
  if (target.staffMfaFactor) {
    await prisma.staffMfaFactor.delete({ where: { id: target.staffMfaFactor.id } });
  }
  await revokeAllStaffSessions({
    userId: target.id,
    reason: "admin-mfa-reset",
    actorUserId: input.actorUserId,
    ip: input.ip ?? null,
  });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: AuditAction.STAFF_MFA_ADMIN_RESET,
    targetType: "User",
    targetId: target.id,
    metadata: { reason: input.reason.slice(0, 500) },
    ipAddress: input.ip ?? null,
  });
  await notifyStaffSecurity(target.email, "KOBA staff MFA was reset", [
    "A Superadmin reset your staff authenticator.",
    "Sign in with your password and enroll MFA again before using staff tools.",
  ]);
}

export async function changeStaffPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  code?: string;
  ip?: string | null;
  nowMs?: number;
}): Promise<void> {
  await requireStaffUser(input.userId);
  await confirmAccountPassword(input.userId, input.currentPassword);
  const factor = await prisma.staffMfaFactor.findUnique({ where: { userId: input.userId } });
  if (factor?.status === "ACTIVE") {
    if (!input.code) {
      throw new StaffMfaError("Authenticator code required.", "INVALID");
    }
    await verifyTotpAgainstFactor(factor, input.code, input.nowMs ?? Date.now());
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash },
  });
  await revokeAllStaffSessions({
    userId: input.userId,
    reason: "password-change",
    ip: input.ip ?? null,
  });
  await writeAuditLog({
    actorUserId: input.userId,
    action: AuditAction.STAFF_PASSWORD_CHANGED,
    targetType: "User",
    targetId: input.userId,
    ipAddress: input.ip ?? null,
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });
  await notifyStaffSecurity(user?.email, "KOBA staff password changed", [
    "Your staff account password was changed.",
    "All privileged staff sessions were signed out. Sign in again with MFA.",
  ]);
}

export async function listRecentStaffSecurityEvents(userId: string) {
  const actions: AuditAction[] = [
    AuditAction.STAFF_MFA_ENROLLMENT_STARTED,
    AuditAction.STAFF_MFA_ENROLLED,
    AuditAction.STAFF_MFA_CHALLENGE_SUCCEEDED,
    AuditAction.STAFF_MFA_CHALLENGE_FAILED,
    AuditAction.STAFF_MFA_RECOVERY_CODE_USED,
    AuditAction.STAFF_MFA_RECOVERY_CODES_REGENERATED,
    AuditAction.STAFF_MFA_DISABLED,
    AuditAction.STAFF_MFA_ADMIN_RESET,
    AuditAction.STAFF_STEP_UP_SUCCEEDED,
    AuditAction.STAFF_STEP_UP_FAILED,
    AuditAction.STAFF_SESSION_CREATED,
    AuditAction.STAFF_SESSION_REVOKED,
    AuditAction.STAFF_SESSIONS_REVOKED_ALL,
    AuditAction.STAFF_ROLE_CHANGED,
    AuditAction.STAFF_PASSWORD_CHANGED,
  ];
  const rows = await prisma.auditLog.findMany({
    where: { actorUserId: userId, action: { in: actions } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, createdAt: true, metadata: true },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.createdAt.toISOString(),
  }));
}
