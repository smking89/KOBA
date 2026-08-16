import { describe, expect, it } from "vitest";
import {
  a2sInfoPacket,
  a2sToStatus,
  extractChallenge,
  isA2sChallenge,
  parseA2sInfo,
  queueFromKeywords,
  queryA2sInfo,
} from "@/features/servers/adapters/rust-a2s";

function cstring(value: string) {
  return Buffer.concat([Buffer.from(value, "utf8"), Buffer.from([0])]);
}

function buildInfo(opts: {
  name: string;
  map: string;
  players: number;
  max: number;
  version: string;
  keywords?: string;
}) {
  const header = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x11]);
  const rest = Buffer.concat([
    cstring(opts.name),
    cstring(opts.map),
    cstring("rust"),
    cstring("Rust"),
    Buffer.from([0x00, 0x00, opts.players, opts.max, 0, 0x64, 0x6c, 0, 1]),
    cstring(opts.version),
    Buffer.from([opts.keywords ? 0x20 : 0x00]),
    opts.keywords ? cstring(opts.keywords) : Buffer.alloc(0),
  ]);
  return Buffer.concat([header, rest]);
}

describe("Rust A2S public query", () => {
  it("parses name, players, map, version, tags, and queue", () => {
    const buf = buildInfo({
      name: "KOBA Rust",
      map: "Procedural Map",
      players: 0,
      max: 100,
      version: "2600",
      keywords: "mp100,cp0,qp3,oxide",
    });
    const info = parseA2sInfo(buf);
    expect(info.name).toBe("KOBA Rust");
    expect(info.map).toBe("Procedural Map");
    expect(info.players).toBe(0);
    expect(info.maxPlayers).toBe(100);
    expect(info.version).toBe("2600");
    expect(info.queue).toBe(3);
    expect(info.tags).toContain("oxide");
  });

  it("does not invent queue when qp is absent", () => {
    expect(queueFromKeywords("mp100,cp12,oxide")).toBeNull();
  });

  it("distinguishes zero players from a failed query", () => {
    const zero = a2sToStatus(
      parseA2sInfo(buildInfo({ name: "Empty", map: "X", players: 0, max: 50, version: "1" })),
      12,
      null,
    );
    expect(zero.livePlayers).toBe(0);
    expect(zero.fieldPresence?.livePlayers).toBe("AVAILABLE");
    const failed = a2sToStatus(parseA2sInfo(Buffer.alloc(0)), null, "TIMEOUT");
    expect(failed.livePlayers).toBeNull();
    expect(failed.fieldPresence?.livePlayers).toBe("FAILED");
    expect(failed.successful).toBe(false);
  });

  it("retries after a challenge using the injected transport", async () => {
    const challenge = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41, 1, 2, 3, 4]);
    const info = buildInfo({ name: "Challenged", map: "M", players: 2, max: 10, version: "2" });
    let calls = 0;
    const result = await queryA2sInfo(
      { hostname: "203.0.113.10", resolvedIps: ["203.0.113.10"], port: 28015 },
      async ({ packet }) => {
        calls += 1;
        if (calls === 1) {
          expect(packet.equals(a2sInfoPacket())).toBe(true);
          return challenge;
        }
        expect(packet.equals(a2sInfoPacket(extractChallenge(challenge)))).toBe(true);
        return info;
      },
    );
    expect(isA2sChallenge(challenge)).toBe(true);
    expect(result.info.name).toBe("Challenged");
    expect(result.info.players).toBe(2);
    expect(result.error).toBeNull();
  });
});
