import { describe, expect, it } from "vitest";
import {
  parseServerInfoMessage,
  queryWebRconServerInfo,
  serverInfoToStatus,
  WebRconError,
} from "@/features/servers/adapters/rust-webrcon";
import { createRustAdapter, mergePublicAndRcon } from "@/features/servers/adapters/rust";
import { rejectArbitraryCommand } from "@/features/servers/lib/rcon-policy";

const target = { hostname: "203.0.113.10", resolvedIps: ["203.0.113.10"], port: 28016 };

describe("Rust WebRCON", () => {
  it("parses serverinfo JSON and keeps map size unsupported", () => {
    const info = parseServerInfoMessage(
      JSON.stringify({
        Hostname: "KOBA",
        MaxPlayers: 80,
        Players: 0,
        Queued: 4,
        Map: "Procedural Map",
      }),
    );
    expect(info?.Queued).toBe(4);
    const status = serverInfoToStatus(info!);
    expect(status.livePlayers).toBe(0);
    expect(status.queue).toBe(4);
    expect(status.fieldPresence?.mapSize).toBe("UNSUPPORTED");
    expect(status.mapSize).toBeNull();
  });

  it("classifies invalid credentials and timeouts from the transport", async () => {
    const auth = await queryWebRconServerInfo(target, {
      password: "wrong",
      hostHeader: "203.0.113.10:28016",
      transport: async () => {
        throw new WebRconError("auth", "INVALID_CREDENTIALS");
      },
    });
    expect(auth.successful).toBe(false);
    expect(auth.errorCategory).toBe("INVALID_CREDENTIALS");

    const timeout = await queryWebRconServerInfo(target, {
      password: "x",
      hostHeader: "203.0.113.10:28016",
      transport: async () => {
        throw new WebRconError("timeout", "TIMEOUT");
      },
    });
    expect(timeout.errorCategory).toBe("TIMEOUT");
  });

  it("rejects protocol mismatch when the payload is not serverinfo JSON", async () => {
    const result = await queryWebRconServerInfo(target, {
      password: "x",
      hostHeader: "203.0.113.10:28016",
      transport: async () => "not-json",
    });
    expect(result.errorCategory).toBe("PROTOCOL_MISMATCH");
  });

  it("never accepts arbitrary command text on the adapter", async () => {
    const adapter = createRustAdapter({
      webrconTransport: async (request) => {
        expect(request.action).toBe("SERVER_INFO");
        return JSON.stringify({ Players: 1, MaxPlayers: 10, Queued: 0, Map: "X", Hostname: "H" });
      },
    });
    const status = await adapter.queryReadOnlyStatus(target, {
      gameSlug: "rust",
      platformFamily: "PC",
      hostname: "203.0.113.10",
      queryPort: 28015,
      gamePort: 28015,
      rconPort: 28016,
      password: "secret",
    });
    expect(status.successful).toBe(true);
    expect(adapter.capabilities("rust", "PC")).not.toContain("RCON_WRITE");
    expect(() => rejectArbitraryCommand("status; kick all")).toThrow();
  });
});

describe("status merge", () => {
  it("does not overwrite a supported value with a missing field", () => {
    const publicStatus = {
      operationalState: "ONLINE" as const,
      livePlayers: 3,
      maxPlayers: 50,
      queue: null,
      mapName: "A",
      mapSize: null,
      pingMs: 20,
      successful: true,
      errorCategory: null,
      source: "rust-a2s",
      rustVersion: "2600",
      serverTags: ["oxide"],
      fieldPresence: {
        livePlayers: "AVAILABLE" as const,
        maxPlayers: "AVAILABLE" as const,
        queue: "UNSUPPORTED" as const,
        mapName: "AVAILABLE" as const,
        mapSize: "UNSUPPORTED" as const,
        pingMs: "AVAILABLE" as const,
        serverName: "AVAILABLE" as const,
        serverTags: "AVAILABLE" as const,
        rustVersion: "AVAILABLE" as const,
      },
    };
    const rcon = {
      ...publicStatus,
      livePlayers: null,
      queue: 2,
      pingMs: null,
      source: "rust-webrcon",
      fieldPresence: {
        ...publicStatus.fieldPresence,
        livePlayers: "UNSUPPORTED" as const,
        queue: "AVAILABLE" as const,
        pingMs: "UNSUPPORTED" as const,
        rustVersion: "UNSUPPORTED" as const,
        serverTags: "UNSUPPORTED" as const,
      },
    };
    const merged = mergePublicAndRcon(publicStatus, rcon);
    expect(merged.livePlayers).toBe(3);
    expect(merged.queue).toBe(2);
    expect(merged.pingMs).toBe(20);
    expect(merged.rustVersion).toBe("2600");
    expect(merged.mapSize).toBeNull();
  });
});
