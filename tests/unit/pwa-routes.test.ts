import { describe, expect, it } from "vitest";
import {
  isSensitivePath,
  NEVER_CACHE_PATH_PREFIXES,
  prefersNetworkFirst,
} from "@/lib/pwa/sensitive-routes";

describe("isSensitivePath", () => {
  it("blocks auth and payment API prefixes", () => {
    expect(isSensitivePath("/api/auth/session")).toBe(true);
    expect(isSensitivePath("/api/stripe/webhook")).toBe(true);
    expect(isSensitivePath("/api/messages/123")).toBe(true);
  });

  it("allows public routes", () => {
    expect(isSensitivePath("/market")).toBe(false);
    expect(isSensitivePath("/api/health")).toBe(false);
  });

  it("documents every denylist prefix", () => {
    expect(NEVER_CACHE_PATH_PREFIXES.length).toBeGreaterThan(0);
  });
});

describe("prefersNetworkFirst", () => {
  it("marks dynamic surfaces as network-first", () => {
    expect(prefersNetworkFirst("/market")).toBe(true);
    expect(prefersNetworkFirst("/feed")).toBe(true);
  });

  it("treats sensitive paths as network-only preference", () => {
    expect(prefersNetworkFirst("/api/auth/callback")).toBe(true);
  });
});
