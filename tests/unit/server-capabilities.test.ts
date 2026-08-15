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
});
