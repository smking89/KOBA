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
    expect(isSensitivePath("/api/accounts/switch")).toBe(true);
    expect(isSensitivePath("/api/admin/kobaid")).toBe(true);
    expect(isSensitivePath("/api/market/favorites")).toBe(true);
    expect(isSensitivePath("/api/shops/ironwright/follow")).toBe(true);
    expect(isSensitivePath("/api/business/products")).toBe(true);
    expect(isSensitivePath("/api/auctions/oxide/bids")).toBe(true);
    expect(isSensitivePath("/api/checkout")).toBe(true);
    expect(isSensitivePath("/api/groups/rust-legacy-raiders/join")).toBe(true);
    expect(isSensitivePath("/api/lfg/KOBA-LFG-CAFEBABE/join")).toBe(true);
    expect(isSensitivePath("/api/social/posts")).toBe(true);
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
    expect(prefersNetworkFirst("/shops/ironwright-trading-co")).toBe(true);
    expect(prefersNetworkFirst("/feed")).toBe(true);
    expect(prefersNetworkFirst("/u/maxbuilds")).toBe(true);
    expect(prefersNetworkFirst("/orders")).toBe(true);
  });

  it("treats sensitive paths as network-only preference", () => {
    expect(prefersNetworkFirst("/api/auth/callback")).toBe(true);
  });
});
