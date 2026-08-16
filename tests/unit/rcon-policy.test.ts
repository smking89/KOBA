import { describe, expect, it } from "vitest";
import {
  assertReadonlyAction,
  commandForAction,
  rejectArbitraryCommand,
  RconPolicyError,
} from "@/features/servers/lib/rcon-policy";
import { isApprovedRustPort } from "@/features/servers/lib/rust-ports";
import { assertNoSecrets, redactStructured } from "@/features/servers/lib/redact";
import { assertNotImpersonating } from "@/features/servers/services/integration.service";

describe("read-only RCON policy", () => {
  it("maps only the allowlisted action", () => {
    expect(commandForAction("SERVER_INFO")).toBe("serverinfo");
    expect(assertReadonlyAction("SERVER_INFO")).toBe("SERVER_INFO");
  });

  it("rejects arbitrary and admin commands", () => {
    expect(() => assertReadonlyAction("kick")).toThrow(RconPolicyError);
    expect(() => assertReadonlyAction("ARBITRARY_COMMAND")).toThrow(RconPolicyError);
    expect(() => rejectArbitraryCommand("ban 7656119")).toThrow(RconPolicyError);
  });
});

describe("rust ports", () => {
  it("allows Facepunch defaults and rejects disallowed ports", () => {
    expect(isApprovedRustPort(28015)).toBe(true);
    expect(isApprovedRustPort(28016)).toBe(true);
    expect(isApprovedRustPort(22)).toBe(false);
    expect(isApprovedRustPort(5432)).toBe(false);
    expect(isApprovedRustPort(80)).toBe(false);
  });
});

describe("secret redaction", () => {
  it("refuses credential fields in API payloads", () => {
    expect(() => assertNoSecrets({ password: "x" })).toThrow(/credential/);
    expect(assertNoSecrets({ credentialsConfigured: true }).credentialsConfigured).toBe(true);
    expect(redactStructured({ password: "x", ok: true })).toEqual({
      password: "[redacted]",
      ok: true,
    });
  });
});

describe("impersonation guard", () => {
  it("blocks staff impersonation from credential operations", () => {
    expect(() => assertNotImpersonating({ impersonatorId: "staff_1" })).toThrow(/impersonation/);
    expect(() => assertNotImpersonating({ impersonatorId: null })).not.toThrow();
  });
});
