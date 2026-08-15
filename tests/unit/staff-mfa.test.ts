import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildOtpauthUri,
  generateTotpSecret,
  timeStep,
  totpCodeAt,
  verifyTotp,
  TOTP_PERIOD_SECONDS,
} from "@/lib/crypto/totp";
import {
  isStaffMfaEncryptionConfigured,
  openTotpSecret,
  resolveStaffMfaKey,
  sealTotpSecret,
  StaffMfaCryptoError,
} from "@/lib/crypto/staff-mfa-box";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashesEqual,
} from "@/features/staff-mfa/lib/recovery-codes";
import {
  assessStaffSession,
  hashChallengeToken,
  hashElevationToken,
} from "@/features/staff-mfa/lib/session-policy";
import { isSensitiveDocumentPath, isSensitivePath } from "@/lib/pwa/sensitive-routes";
import { isAuthPath } from "@/lib/auth/protected-routes";
import { STAFF_ELEVATION_COOKIE } from "@/features/staff-mfa/lib/config";
import { jsonStaffMfa } from "@/features/staff-mfa/lib/http";
import { StaffMfaError, staffMfaErrorStatus } from "@/features/staff-mfa/lib/errors";
import { isStaffMfaEnforced } from "@/features/staff-mfa/lib/config";
import {
  disableMfaSchema,
  changePasswordSchema,
} from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { hashIpForPrivacy, sanitizeUserAgent } from "@/features/staff-mfa/lib/session-policy";
import { switchAccountSchema } from "@/features/accounts/schemas/account.schemas";

const KEY = Buffer.alloc(32, 9).toString("base64");

describe("TOTP (KOBA-SEC-003)", () => {
  const secret = generateTotpSecret();
  const now = Date.UTC(2026, 7, 15, 12, 0, 5);

  it("accepts the current 6-digit code", () => {
    const code = totpCodeAt(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, { nowMs: now })).toEqual({
      ok: true,
      step: timeStep(now),
    });
  });

  it("accepts documented ±1-step clock skew", () => {
    const earlier = totpCodeAt(secret, now - TOTP_PERIOD_SECONDS * 1000);
    const later = totpCodeAt(secret, now + TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotp(secret, earlier, { nowMs: now }).ok).toBe(true);
    expect(verifyTotp(secret, later, { nowMs: now }).ok).toBe(true);
  });

  it("rejects excessive clock skew", () => {
    const far = totpCodeAt(secret, now - 3 * TOTP_PERIOD_SECONDS * 1000);
    expect(verifyTotp(secret, far, { nowMs: now }).ok).toBe(false);
  });

  it("rejects an already-accepted time step (replay)", () => {
    const code = totpCodeAt(secret, now);
    const first = verifyTotp(secret, code, { nowMs: now });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(verifyTotp(secret, code, { nowMs: now, minStepExclusive: first.step }).ok).toBe(false);
  });

  it("rejects invalid formats without leaking", () => {
    expect(verifyTotp(secret, "12", { nowMs: now }).ok).toBe(false);
    expect(verifyTotp(secret, "abcdef", { nowMs: now }).ok).toBe(false);
  });

  it("builds an otpauth URI that does not belong in logs", () => {
    const uri = buildOtpauthUri({
      issuer: "KOBA",
      accountName: "staff@koba.local",
      secret,
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("staff TOTP encryption", () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.KOBA_STAFF_MFA_ENCRYPTION_KEY = KEY;
    process.env.KOBA_STAFF_MFA_KEY_VERSION = "1";
    delete process.env.KOBA_STAFF_MFA_ENCRYPTION_KEY_V1;
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it("round-trips with unique IVs and binds AAD to the user", () => {
    const first = sealTotpSecret("JBSWY3DPEHPK3PXP", "user-1");
    const second = sealTotpSecret("JBSWY3DPEHPK3PXP", "user-1");
    expect(openTotpSecret(first, "user-1")).toBe("JBSWY3DPEHPK3PXP");
    expect(first.iv).not.toBe(second.iv);
    expect(() => openTotpSecret(first, "user-2")).toThrow(StaffMfaCryptoError);
  });

  it("fails closed when the key is missing", () => {
    delete process.env.KOBA_STAFF_MFA_ENCRYPTION_KEY;
    expect(isStaffMfaEncryptionConfigured()).toBe(false);
    expect(() => resolveStaffMfaKey()).toThrow(/required/);
  });
});

describe("recovery codes", () => {
  it("hashes normalized codes and compares in constant time", () => {
    const codes = generateRecoveryCodes(1);
    const code = codes[0] ?? "";
    expect(code.length).toBeGreaterThan(0);
    const hash = hashRecoveryCode(code);
    expect(recoveryHashesEqual(hash, hashRecoveryCode(code.toUpperCase()))).toBe(true);
    expect(recoveryHashesEqual(hash, hashRecoveryCode("not-the-code-xx"))).toBe(false);
    expect(looksLikeRecoveryCode(code)).toBe(true);
    expect(looksLikeRecoveryCode("123456")).toBe(false);
    expect(normalizeRecoveryCode(code)).toHaveLength(10);
  });
});

describe("staff session policy", () => {
  const base = {
    id: "s1",
    userId: "u1",
    createdAt: new Date(1_000),
    lastSeenAt: new Date(1_000),
    lastMfaAt: new Date(1_000),
    expiresAt: new Date(100_000),
    revokedAt: null,
  };

  it("rejects revoked, idle, and absolute-expired elevations", () => {
    expect(assessStaffSession({ ...base, revokedAt: new Date(2_000) }, 3_000).ok).toBe(false);
    expect(assessStaffSession(base, 100_000).ok).toBe(false);
    expect(assessStaffSession(base, 70_000, { idleMs: 60_000 }).ok).toBe(false);
  });

  it("marks step-up stale after the window", () => {
    const fresh = assessStaffSession(base, 2_000, { idleMs: 60_000, stepUpMs: 15_000 });
    expect(fresh.ok && fresh.stepUpFresh).toBe(true);
    const stale = assessStaffSession(base, 20_000, { idleMs: 60_000, stepUpMs: 15_000 });
    expect(stale.ok && stale.stepUpFresh).toBe(false);
  });

  it("does not treat challenge tokens as elevation tokens", () => {
    const raw = "token-value";
    expect(hashChallengeToken(raw)).not.toBe(hashElevationToken(raw));
  });
});

describe("staff MFA routes are never cached", () => {
  it("marks MFA APIs and pages sensitive", () => {
    expect(isSensitivePath("/api/staff-mfa/challenge")).toBe(true);
    expect(isSensitivePath("/api/staff-mfa/password")).toBe(true);
    expect(isSensitiveDocumentPath("/login/mfa")).toBe(true);
    expect(isSensitiveDocumentPath("/settings/security")).toBe(true);
    expect(isAuthPath("/login")).toBe(true);
    expect(STAFF_ELEVATION_COOKIE).toBe("koba_staff_aal2");
  });

  it("sends Cache-Control no-store on staff MFA JSON", () => {
    const response = jsonStaffMfa({ ok: true });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("staff MFA policy helpers", () => {
  it("enforces MFA unless STAFF_MFA_ENFORCE is explicitly false", () => {
    const previous = process.env.STAFF_MFA_ENFORCE;
    delete process.env.STAFF_MFA_ENFORCE;
    expect(isStaffMfaEnforced()).toBe(true);
    process.env.STAFF_MFA_ENFORCE = "false";
    expect(isStaffMfaEnforced()).toBe(false);
    process.env.STAFF_MFA_ENFORCE = previous;
  });

  it("maps AAL1 and step-up failures to 403", () => {
    expect(staffMfaErrorStatus("MFA_REQUIRED")).toBe(403);
    expect(staffMfaErrorStatus("MFA_ENROLLMENT_REQUIRED")).toBe(403);
    expect(staffMfaErrorStatus("STEP_UP_REQUIRED")).toBe(403);
    expect(new StaffMfaError("Staff only.", "FORBIDDEN").message).not.toMatch(/secret|totp/i);
  });

  it("requires explicit confirmation to disable MFA", () => {
    expect(disableMfaSchema.safeParse({ password: "x", code: "123456" }).success).toBe(false);
    expect(
      disableMfaSchema.safeParse({ password: "x", code: "123456", confirm: true }).success,
    ).toBe(true);
  });

  it("rejects a weak staff password change", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "short",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password",
        newPassword: "NewPassword12",
        code: "123456",
      }).success,
    ).toBe(true);
  });

  it("never exposes raw IPs and sanitizes user agents", () => {
    const hint = hashIpForPrivacy("203.0.113.9");
    expect(hint).not.toContain("203.0.113");
    expect(hint).toHaveLength(64);
    expect(sanitizeUserAgent("Mozilla/5.0\n<script>")).toBe("Mozilla/5.0<script>");
    expect(sanitizeUserAgent(`${"A".repeat(200)}`)).toHaveLength(160);
  });

  it("does not let public account switching select a staff type", () => {
    expect(switchAccountSchema.safeParse({ accountType: "SUPERADMIN" }).success).toBe(false);
    expect(switchAccountSchema.safeParse({ accountType: "PLAYER" }).success).toBe(true);
  });
});
