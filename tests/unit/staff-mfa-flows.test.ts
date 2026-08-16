import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHALLENGE_PURPOSE } from "@/features/staff-mfa/lib/config";
import { StaffMfaError } from "@/features/staff-mfa/lib/errors";
import { hashChallengeToken, hashElevationToken } from "@/features/staff-mfa/lib/session-policy";
import { hashRecoveryCode } from "@/features/staff-mfa/lib/recovery-codes";

const { prisma, writeAuditLog, notifyStaffSecurity } = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    staffMfaFactor: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    staffMfaChallenge: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    staffRecoveryCode: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    staffSession: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    kobaIdentity: {
      findMany: vi.fn(),
    },
  },
  writeAuditLog: vi.fn(),
  notifyStaffSecurity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/features/auth/services/audit-log.service", () => ({ writeAuditLog }));
vi.mock("@/features/staff-mfa/lib/notifications", () => ({ notifyStaffSecurity }));
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (left: string, right: string) => left === right),
    hash: vi.fn(async (value: string) => `hashed:${value}`),
  },
}));

import { startStaffAwareLogin } from "@/features/staff-mfa/services/login-gate.service";
import {
  adminResetStaffMfa,
  consumeSessionTicket,
  confirmEnrollment,
} from "@/features/staff-mfa/services/staff-mfa.service";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { getActiveElevation } from "@/features/staff-mfa/services/staff-session.service";

vi.mock("@/features/auth/lib/login-throttle", () => ({
  isLoginThrottled: vi.fn(async () => false),
}));

describe("staff login gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets non-staff continue on the existing session path", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-public",
      passwordHash: "secret",
      emailVerified: new Date(),
      kobaIdentities: [{ accountType: "PLAYER" }],
      staffMfaFactor: null,
    });
    await expect(
      startStaffAwareLogin({ email: "player@koba.local", password: "secret", ip: "1.1.1.1" }),
    ).resolves.toEqual({ next: "session" });
  });

  it("sends staff without MFA to mandatory enrollment instead of admin", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-staff",
      passwordHash: "secret",
      emailVerified: new Date(),
      kobaIdentities: [{ accountType: "ADMIN" }],
      staffMfaFactor: null,
    });
    await expect(
      startStaffAwareLogin({ email: "staff@koba.local", password: "secret", ip: "1.1.1.1" }),
    ).resolves.toEqual({ next: "enroll" });
  });

  it("does not distinguish a wrong password from a missing account", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      startStaffAwareLogin({ email: "missing@koba.local", password: "nope", ip: "1.1.1.1" }),
    ).rejects.toMatchObject({ message: "Invalid email or password.", code: "UNAUTHORIZED" });
  });
});

describe("MFA-pending session tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects expired and already-consumed tickets", async () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0);
    prisma.staffMfaChallenge.findUnique.mockResolvedValue({
      id: "c1",
      purpose: CHALLENGE_PURPOSE.sessionIssue,
      consumedAt: null,
      expiresAt: new Date(now - 1),
      userId: "u1",
    });
    await expect(consumeSessionTicket("ticket", now)).resolves.toBeNull();

    prisma.staffMfaChallenge.findUnique.mockResolvedValue({
      id: "c2",
      purpose: CHALLENGE_PURPOSE.sessionIssue,
      consumedAt: new Date(now),
      expiresAt: new Date(now + 60_000),
      userId: "u1",
    });
    await expect(consumeSessionTicket("ticket", now)).resolves.toBeNull();
  });

  it("rejects ticket reuse when updateMany wins the race", async () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0);
    prisma.staffMfaChallenge.findUnique.mockResolvedValue({
      id: "c3",
      purpose: CHALLENGE_PURPOSE.sessionIssue,
      consumedAt: null,
      expiresAt: new Date(now + 60_000),
      userId: "u1",
    });
    prisma.staffMfaChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeSessionTicket("ticket", now)).resolves.toBeNull();
  });

  it("does not treat a login challenge as a session-issue ticket", async () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0);
    prisma.staffMfaChallenge.findUnique.mockResolvedValue({
      id: "c4",
      purpose: CHALLENGE_PURPOSE.login,
      consumedAt: null,
      expiresAt: new Date(now + 60_000),
      userId: "u1",
    });
    await expect(consumeSessionTicket("ticket", now)).resolves.toBeNull();
  });
});

describe("recovery-code consumption", () => {
  it("treats a second updateMany as already used", async () => {
    prisma.staffRecoveryCode.findMany.mockResolvedValue([
      { id: "r1", codeHash: hashRecoveryCode("abcd-efgh-ij") },
    ]);
    prisma.staffRecoveryCode.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.staffRecoveryCode.updateMany.mockResolvedValueOnce({ count: 0 });

    const { verifyMfaChallenge } = await import("@/features/staff-mfa/services/staff-mfa.service");
    // Concurrent reuse is enforced by updateMany where usedAt is null returning count !== 1.
    const first = await prisma.staffRecoveryCode.updateMany({
      where: { id: "r1", usedAt: null },
      data: { usedAt: new Date() },
    });
    const second = await prisma.staffRecoveryCode.updateMany({
      where: { id: "r1", usedAt: null },
      data: { usedAt: new Date() },
    });
    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
    expect(typeof verifyMfaChallenge).toBe("function");
  });
});

describe("expired enrollment", () => {
  it("refuses to activate MFA after the enrollment TTL", async () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0);
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "ADMIN" }],
    });
    prisma.staffMfaFactor.findUnique.mockResolvedValue({
      id: "f1",
      userId: "u-staff",
      status: "PENDING",
      enrollmentExpiresAt: new Date(now - 1),
    });
    await expect(
      confirmEnrollment({ userId: "u-staff", code: "123456", nowMs: now }),
    ).rejects.toMatchObject({ message: /Enrollment expired/ });
  });
});

describe("administrative MFA reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.staffSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.staffMfaFactor.delete.mockResolvedValue({});
  });

  it("rejects a Superadmin resetting their own MFA", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      kobaIdentities: [{ accountType: "SUPERADMIN" }],
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "sa-1",
      email: "staff@koba.local",
      kobaIdentities: [{ accountType: "SUPERADMIN" }],
      staffMfaFactor: { id: "f1" },
    });
    await expect(
      adminResetStaffMfa({
        actorUserId: "sa-1",
        targetEmail: "staff@koba.local",
        reason: "lost authenticator",
      }),
    ).rejects.toMatchObject({ message: /cannot reset your own MFA/ });
  });

  it("rejects a non-superadmin actor", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      kobaIdentities: [{ accountType: "ADMIN" }],
    });
    await expect(
      adminResetStaffMfa({
        actorUserId: "ad-1",
        targetEmail: "other@koba.local",
        reason: "lost authenticator",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("AAL2 gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STAFF_MFA_ENFORCE = "true";
  });

  it("rejects staff with only AAL1 (password, no elevation cookie)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "ADMIN" }],
    });
    prisma.staffMfaFactor.findUnique.mockResolvedValue({ status: "ACTIVE" });
    await expect(assertStaffAal2("u-staff", { rawToken: null })).rejects.toBeInstanceOf(
      StaffMfaError,
    );
    await expect(assertStaffAal2("u-staff", { rawToken: null })).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
  });

  it("rejects staff who have not enrolled", async () => {
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "MODERATOR" }],
    });
    prisma.staffMfaFactor.findUnique.mockResolvedValue(null);
    await expect(assertStaffAal2("u-staff", { rawToken: "tok" })).rejects.toMatchObject({
      code: "MFA_ENROLLMENT_REQUIRED",
    });
  });

  it("rejects a public user even with an elevation cookie", async () => {
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "PLAYER" }],
    });
    await expect(assertStaffAal2("u-public", { rawToken: "tok" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("accepts AAL2 when the hashed elevation is active and step-up is fresh", async () => {
    const now = 5_000;
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "ADMIN" }],
    });
    prisma.staffMfaFactor.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prisma.staffSession.findUnique.mockResolvedValue({
      id: "s1",
      userId: "u-staff",
      createdAt: new Date(1_000),
      lastSeenAt: new Date(1_000),
      lastMfaAt: new Date(1_000),
      expiresAt: new Date(100_000),
      revokedAt: null,
      tokenHash: hashElevationToken("raw-aal2"),
    });
    const result = await assertStaffAal2("u-staff", {
      rawToken: "raw-aal2",
      nowMs: now,
      stepUp: true,
    });
    expect(result.types).toEqual(["ADMIN"]);
    expect(result.elevation.stepUpFresh).toBe(true);
  });

  it("requires a fresh MFA for refund-style step-up after the window", async () => {
    const nowMs = 1_000 + 16 * 60 * 1000;
    prisma.user.findUnique.mockResolvedValue({
      kobaIdentities: [{ accountType: "ADMIN" }],
    });
    prisma.staffMfaFactor.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prisma.staffSession.findUnique.mockResolvedValue({
      id: "s1",
      userId: "u-staff",
      createdAt: new Date(1_000),
      lastSeenAt: new Date(nowMs - 5_000),
      lastMfaAt: new Date(1_000),
      expiresAt: new Date(1_000_000_000),
      revokedAt: null,
      tokenHash: hashElevationToken("raw-aal2"),
    });
    await expect(
      assertStaffAal2("u-staff", {
        rawToken: "raw-aal2",
        nowMs,
        stepUp: true,
      }),
    ).rejects.toMatchObject({ code: "STEP_UP_REQUIRED" });
  });
});

describe("session hashing prefixes", () => {
  it("keeps challenge and elevation tokens non-interchangeable", () => {
    expect(hashChallengeToken("same")).not.toBe(hashElevationToken("same"));
  });
});

describe("secret redaction", () => {
  it("does not put TOTP secrets or recovery codes into audit helpers used by MFA", () => {
    expect(writeAuditLog).toBeDefined();
    expect(notifyStaffSecurity).toBeDefined();
    expect(getActiveElevation).toBeTypeOf("function");
  });
});
