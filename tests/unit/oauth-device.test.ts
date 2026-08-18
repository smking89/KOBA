// @vitest-environment node
//
// jose's SignJWT/jwtVerify do an `instanceof Uint8Array` check that fails
// under jsdom's polyfilled TextEncoder (different realm) — same issue
// documented in tests/unit/auth-oauth.test.ts. Force plain Node here too.
import { afterEach, describe, expect, it, vi } from "vitest";
import { newAccessToken, newDeviceCode, newUserCode, hashAccessToken, hashDeviceCode } from "@/features/oauth-device/lib/tokens";
import { isValidDeviceClientKey, isValidScope, OAUTH_DEVICE_CLIENTS } from "@/features/oauth-device/lib/clients";
import { signSteamLinkState, verifySteamLinkState } from "@/features/steam-link/lib/state";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("newUserCode", () => {
  it("produces an 8-character code with a dash after the 4th character", () => {
    const code = newUserCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("never contains ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = newUserCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it("is not perfectly predictable across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => newUserCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("newDeviceCode / newAccessToken hashing", () => {
  it("hashes are deterministic for the same raw value", () => {
    const device = newDeviceCode();
    expect(hashDeviceCode(device.raw)).toBe(device.hash);
  });

  it("device code and access token hashes are namespaced apart", () => {
    // Same raw value fed through both hash functions must not collide —
    // otherwise a leaked device code could be replayed as an access token.
    const raw = "shared-raw-value-for-namespace-test";
    expect(hashDeviceCode(raw)).not.toBe(hashAccessToken(raw));
  });

  it("access tokens carry a recognizable prefix", () => {
    const token = newAccessToken();
    expect(token.raw.startsWith("koba_at_")).toBe(true);
  });
});

describe("isValidDeviceClientKey / isValidScope", () => {
  it("accepts the registered pc-plugin client", () => {
    expect(isValidDeviceClientKey("pc-plugin")).toBe(true);
    expect(OAUTH_DEVICE_CLIENTS["pc-plugin"].defaultScopes).toContain("inventory:read");
  });

  it("rejects an unregistered client key", () => {
    expect(isValidDeviceClientKey("discord-bot")).toBe(false);
    expect(isValidDeviceClientKey("")).toBe(false);
  });

  it("validates known scopes only", () => {
    expect(isValidScope("inventory:read")).toBe(true);
    expect(isValidScope("inventory:write")).toBe(true);
    expect(isValidScope("admin:everything")).toBe(false);
  });
});

describe("signSteamLinkState / verifySteamLinkState", () => {
  it("round-trips the userId", async () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    const token = await signSteamLinkState({ userId: "user_123" });
    const parsed = await verifySteamLinkState(token);
    expect(parsed).toEqual({ userId: "user_123" });
  });

  it("rejects a tampered token", async () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    const token = await signSteamLinkState({ userId: "user_123" });
    const parsed = await verifySteamLinkState(`${token}x`);
    expect(parsed).toBeNull();
  });
});
