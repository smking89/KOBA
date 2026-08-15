import { describe, expect, it } from "vitest";
import { decodePacket, encodePacket } from "@/features/servers/lib/rcon/source-rcon";
import { buildRequest, parseInfoResponse } from "@/features/servers/lib/rcon/source-query";
import { protocolForGame } from "@/features/servers/lib/rcon/registry";

describe("Source RCON packet encode/decode", () => {
  it("round-trips id/type/body through encode then decode", () => {
    const packet = encodePacket(42, 3, "hunter2");
    // Strip the 4-byte size prefix decodePacket expects to receive
    // separately (the real socket reader does this split itself).
    const decoded = decodePacket(packet.subarray(4));
    expect(decoded.id).toBe(42);
    expect(decoded.type).toBe(3);
    expect(decoded.body).toBe("hunter2");
  });

  it("round-trips an empty body", () => {
    const packet = encodePacket(1, 2, "");
    const decoded = decodePacket(packet.subarray(4));
    expect(decoded.body).toBe("");
  });

  it("encodes the size prefix correctly (ID + Type + body + null + pad)", () => {
    const packet = encodePacket(1, 2, "status");
    const size = packet.readInt32LE(0);
    // 4 (ID) + 4 (Type) + 6 (body "status") + 1 (null) + 1 (pad)
    expect(size).toBe(16);
    expect(packet.length).toBe(4 + size);
  });

  it("preserves a -1 auth-failure id (must not be coerced to unsigned)", () => {
    const packet = encodePacket(-1, 2, "");
    const decoded = decodePacket(packet.subarray(4));
    expect(decoded.id).toBe(-1);
  });
});

describe("A2S_INFO query request", () => {
  it("starts with the FF FF FF FF 54 header + query string", () => {
    const req = buildRequest();
    expect(req.subarray(0, 5)).toEqual(Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]));
    expect(req.toString("ascii", 5)).toBe("Source Engine Query\0");
  });

  it("appends the challenge bytes on a second request", () => {
    const challenge = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const req = buildRequest(challenge);
    expect(req.subarray(req.length - 4)).toEqual(challenge);
  });
});

describe("A2S_INFO response parsing", () => {
  function buildInfoResponse(input: {
    name: string;
    map: string;
    folder: string;
    game: string;
    players: number;
    maxPlayers: number;
  }): Buffer {
    return Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x11]), // header + 'I' + protocol version
      Buffer.from(`${input.name}\0`, "utf8"),
      Buffer.from(`${input.map}\0`, "utf8"),
      Buffer.from(`${input.folder}\0`, "utf8"),
      Buffer.from(`${input.game}\0`, "utf8"),
      Buffer.from([0x00, 0x00]), // steam app id (short)
      Buffer.from([input.players]),
      Buffer.from([input.maxPlayers]),
    ]);
  }

  it("parses server name, map, and player counts", () => {
    const buf = buildInfoResponse({
      name: "Legacy Raiders US",
      map: "Procedural Map",
      folder: "rust",
      game: "Rust",
      players: 42,
      maxPlayers: 100,
    });
    const info = parseInfoResponse(buf);
    expect(info).toEqual({
      serverName: "Legacy Raiders US",
      mapName: "Procedural Map",
      players: 42,
      maxPlayers: 100,
    });
  });

  it("throws SourceQueryError on an unterminated string rather than reading garbage", () => {
    const malformed = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x11, 0x41, 0x42]); // no null terminator
    expect(() => parseInfoResponse(malformed)).toThrow();
  });
});

describe("protocolForGame", () => {
  it("returns SOURCE for PC Rust and Garry's Mod, case-insensitively", () => {
    expect(protocolForGame("Rust", "PC")).toBe("SOURCE");
    expect(protocolForGame("rust", "PC")).toBe("SOURCE");
    expect(protocolForGame("Garry's Mod", "PC")).toBe("SOURCE");
  });

  it("returns null for any CONSOLE server regardless of game", () => {
    expect(protocolForGame("Rust", "CONSOLE")).toBeNull();
    expect(protocolForGame("Garry's Mod", "CONSOLE")).toBeNull();
  });

  it("returns null for a game with no known adapter", () => {
    expect(protocolForGame("Minecraft", "PC")).toBeNull();
    expect(protocolForGame("DayZ", "PC")).toBeNull();
  });
});
