import { describe, expect, it } from "vitest";
import {
  canManagePlatformFunctions,
  isKnownPlatformFunctionKey,
  PLATFORM_FUNCTIONS,
} from "@/features/platform-control/lib/functions";
import { computeAuditHash } from "@/features/auth/services/audit-log.service";

describe("canManagePlatformFunctions", () => {
  it("allows SUPERADMIN only", () => {
    expect(canManagePlatformFunctions(["SUPERADMIN"])).toBe(true);
    expect(canManagePlatformFunctions(["PLAYER", "SUPERADMIN"])).toBe(true);
  });

  it("rejects ADMIN and MODERATOR — narrower than the SA/AD staff gates", () => {
    expect(canManagePlatformFunctions(["ADMIN"])).toBe(false);
    expect(canManagePlatformFunctions(["MODERATOR"])).toBe(false);
    expect(canManagePlatformFunctions(["PLAYER", "BUSINESS"])).toBe(false);
    expect(canManagePlatformFunctions([])).toBe(false);
  });
});

describe("isKnownPlatformFunctionKey", () => {
  it("accepts every registered key", () => {
    for (const fn of PLATFORM_FUNCTIONS) {
      expect(isKnownPlatformFunctionKey(fn.key)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isKnownPlatformFunctionKey("NOT_A_REAL_FUNCTION")).toBe(false);
    expect(isKnownPlatformFunctionKey("")).toBe(false);
  });
});

describe("computeAuditHash", () => {
  const record = {
    actorUserId: "user_1",
    action: "PLATFORM_FUNCTION_DISABLED",
    targetType: "PlatformFunctionFlag",
    targetId: "STRIPE_PAYMENTS",
    metadata: { enabled: false },
    ipAddress: "127.0.0.1",
    createdAt: "2026-08-15T10:00:00.000Z",
  };

  it("is deterministic for the same prevHash and record", () => {
    const a = computeAuditHash(null, record);
    const b = computeAuditHash(null, record);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the previous hash changes — this is the chain link", () => {
    const a = computeAuditHash(null, record);
    const b = computeAuditHash("some-other-prev-hash", record);
    expect(a).not.toBe(b);
  });

  it("changes when any field of the record changes — detects tampering", () => {
    const base = computeAuditHash("prev", record);
    expect(computeAuditHash("prev", { ...record, actorUserId: "user_2" })).not.toBe(base);
    expect(computeAuditHash("prev", { ...record, action: "PLATFORM_FUNCTION_ENABLED" })).not.toBe(
      base,
    );
    expect(computeAuditHash("prev", { ...record, metadata: { enabled: true } })).not.toBe(base);
    expect(computeAuditHash("prev", { ...record, createdAt: "2026-08-15T10:00:01.000Z" })).not.toBe(
      base,
    );
  });
});
