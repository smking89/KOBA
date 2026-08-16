import { describe, expect, it } from "vitest";
import {
  createMinecraftJavaAdapter,
  parseLegacyPing,
} from "@/features/servers/adapters/minecraft-java";

describe("minecraft-java adapter", () => {
  it("parses legacy ping payloads", () => {
    const text = "§1\u0000127\u00001.20\u0000A Minecraft Server\u000012\u0000100";
    const parsed = parseLegacyPing(
      Buffer.concat([Buffer.from([0xff, 0x00, text.length]), Buffer.from(text, "utf16le")]),
    );
    expect(parsed.online).toBe(12);
    expect(parsed.max).toBe(100);
  });

  it("queries via injected transport without real network", async () => {
    const text = "A Server§3§20";
    const response = Buffer.concat([Buffer.from([0xff, 0x00, 0x01]), Buffer.from(text, "utf16le")]);
    const adapter = createMinecraftJavaAdapter(async () => response);
    const result = await adapter.queryStatus(
      { hostname: "play.example", resolvedIps: ["203.0.113.10"], port: 25565 },
      {
        gameSlug: "minecraft-java",
        platformFamily: "PC",
        hostname: "play.example",
        queryPort: 25565,
        gamePort: 25565,
      },
    );
    expect(result.successful).toBe(true);
    expect(result.livePlayers).toBe(3);
    expect(result.maxPlayers).toBe(20);
  });

  it("rejects disallowed ports on validate", () => {
    const adapter = createMinecraftJavaAdapter(async () => Buffer.alloc(0));
    expect(() =>
      adapter.validateTarget({
        gameSlug: "minecraft-java",
        platformFamily: "PC",
        hostname: "play.example",
        queryPort: 22,
        gamePort: null,
      }),
    ).toThrow();
  });
});
