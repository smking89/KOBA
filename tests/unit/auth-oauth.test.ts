// @vitest-environment node
//
// jose's `SignJWT`/`jwtVerify` do an `instanceof Uint8Array` check on the
// signing key. jsdom's polyfilled TextEncoder produces a Uint8Array from a
// different realm than jsdom's own Uint8Array global, which fails that
// check — no existing test in this repo exercises jose, so this is the
// first time that's come up. Forcing the plain Node environment for this
// file sidesteps it.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLoginOAuthConfigured,
  isValidLoginOAuthProvider,
  LOGIN_OAUTH_PROVIDERS,
} from "@/features/auth-oauth/lib/providers";
import { signLoginOAuthState, verifyLoginOAuthState } from "@/features/auth-oauth/lib/state";
import { verifySteamCallback } from "@/features/auth-oauth/lib/steam";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidLoginOAuthProvider", () => {
  it("accepts DISCORD and GOOGLE", () => {
    expect(isValidLoginOAuthProvider("DISCORD")).toBe(true);
    expect(isValidLoginOAuthProvider("GOOGLE")).toBe(true);
  });

  it("rejects Steam and unknown values (Steam isn't in this OAuth2 registry)", () => {
    expect(isValidLoginOAuthProvider("STEAM")).toBe(false);
    expect(isValidLoginOAuthProvider("nonsense")).toBe(false);
  });
});

describe("isLoginOAuthConfigured", () => {
  it("is false until both client id and secret env vars are set", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(isLoginOAuthConfigured("GOOGLE")).toBe(false);

    vi.stubEnv("GOOGLE_CLIENT_ID", "abc");
    expect(isLoginOAuthConfigured("GOOGLE")).toBe(false);

    vi.stubEnv("GOOGLE_CLIENT_SECRET", "def");
    expect(isLoginOAuthConfigured("GOOGLE")).toBe(true);
  });
});

describe("LOGIN_OAUTH_PROVIDERS parseUser", () => {
  it("Discord: extracts id/username/email when present", () => {
    const result = LOGIN_OAUTH_PROVIDERS.DISCORD.parseUser({
      id: "123",
      username: "vest",
      email: "vest@example.com",
    });
    expect(result).toEqual({ id: "123", username: "vest", email: "vest@example.com" });
  });

  it("Discord: email is null when the scope didn't grant it", () => {
    const result = LOGIN_OAUTH_PROVIDERS.DISCORD.parseUser({ id: "123", username: "vest" });
    expect(result).toEqual({ id: "123", username: "vest", email: null });
  });

  it("Discord: rejects a malformed payload", () => {
    expect(LOGIN_OAUTH_PROVIDERS.DISCORD.parseUser({})).toBeNull();
  });

  it("Google: extracts sub/name/email", () => {
    const result = LOGIN_OAUTH_PROVIDERS.GOOGLE.parseUser({
      sub: "g-1",
      name: "Vest",
      email: "vest@gmail.com",
    });
    expect(result).toEqual({ id: "g-1", username: "Vest", email: "vest@gmail.com" });
  });

  it("Google: falls back to the email's local part when name is missing", () => {
    const result = LOGIN_OAUTH_PROVIDERS.GOOGLE.parseUser({ sub: "g-2", email: "terra@gmail.com" });
    expect(result).toEqual({ id: "g-2", username: "terra", email: "terra@gmail.com" });
  });
});

describe("signLoginOAuthState / verifyLoginOAuthState", () => {
  it("round-trips provider and callbackUrl", async () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    const token = await signLoginOAuthState({ provider: "DISCORD", callbackUrl: "/dashboard" });
    const parsed = await verifyLoginOAuthState(token);
    expect(parsed).toEqual({ provider: "DISCORD", callbackUrl: "/dashboard" });
  });

  it("rejects a tampered token", async () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    const token = await signLoginOAuthState({ provider: "DISCORD", callbackUrl: "/dashboard" });
    const parsed = await verifyLoginOAuthState(`${token}tampered`);
    expect(parsed).toBeNull();
  });
});

describe("verifySteamCallback", () => {
  it("rejects a missing claimed_id without making a network call", async () => {
    const result = await verifySteamCallback(new URLSearchParams());
    expect(result).toBeNull();
  });

  it("rejects a claimed_id from the wrong host", async () => {
    const params = new URLSearchParams({ "openid.claimed_id": "https://evil.com/openid/id/12345678901234567" });
    const result = await verifySteamCallback(params);
    expect(result).toBeNull();
  });

  it("rejects a claimed_id whose steamid isn't 17 digits", async () => {
    const params = new URLSearchParams({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/not-a-steamid",
    });
    const result = await verifySteamCallback(params);
    expect(result).toBeNull();
  });
});
