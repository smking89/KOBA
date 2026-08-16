import { describe, expect, it } from "vitest";
import { capabilitiesFor, supportsCapability } from "@/features/servers/lib/capabilities";

describe("capability matrix", () => {
  it("gives Minecraft Java public query + ping on PC", () => {
    const caps = capabilitiesFor("minecraft-java", "PC");
    expect(caps).toContain("PUBLIC_QUERY");
    expect(caps).toContain("PING");
    expect(caps).toContain("PLAYER_COUNT");
    expect(caps).not.toContain("CONSOLE");
  });

  it("does not claim RCON for console editions", () => {
    expect(supportsCapability("rust-console", "CONSOLE", "RCON_WRITE")).toBe(false);
    expect(supportsCapability("rust-console", "CONSOLE", "CONSOLE")).toBe(true);
  });

  it("includes queue for Rust PC", () => {
    expect(supportsCapability("rust", "PC", "QUEUE_COUNT")).toBe(true);
  });

  it("does not enable Rust write or unsupported map size", () => {
    expect(supportsCapability("rust", "PC", "RCON_WRITE")).toBe(false);
    expect(supportsCapability("rust", "PC", "MAP_SIZE")).toBe(false);
    expect(supportsCapability("rust", "PC", "RCON_READ")).toBe(true);
    expect(supportsCapability("rust", "PC", "PUBLIC_QUERY")).toBe(true);
    expect(supportsCapability("rust", "PC", "PING")).toBe(true);
  });
});
