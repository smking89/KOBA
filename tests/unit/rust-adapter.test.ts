import { describe, expect, it } from "vitest";
import { createRustAdapter } from "@/features/servers/adapters/rust";
import { SsrfError } from "@/features/servers/lib/ssrf";

const adapter = createRustAdapter();

describe("rust adapter configuration", () => {
  it("registers read-only capabilities only", () => {
    const caps = adapter.getCapabilities("rust", "PC");
    expect(caps).toEqual(
      expect.arrayContaining(["STATUS", "PLAYER_COUNT", "RCON_READ", "PUBLIC_QUERY", "PC"]),
    );
    expect(caps).not.toContain("RCON_WRITE");
    expect(caps).not.toContain("PLAYER_LIST");
    expect(caps).not.toContain("MAP_SIZE");
  });

  it("rejects private, loopback, link-local, metadata, and disallowed ports", () => {
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "127.0.0.1",
        queryPort: 28015,
        gamePort: 28015,
        rconPort: 28016,
      }),
    ).toThrow(SsrfError);
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "10.0.0.5",
        queryPort: 28015,
        gamePort: 28015,
        rconPort: 28016,
      }),
    ).toThrow(SsrfError);
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "fe80::1",
        queryPort: 28015,
        gamePort: 28015,
        rconPort: 28016,
      }),
    ).toThrow(SsrfError);
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "169.254.169.254",
        queryPort: 28015,
        gamePort: 28015,
        rconPort: 28016,
      }),
    ).toThrow(SsrfError);
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "203.0.113.10",
        queryPort: 22,
        gamePort: 22,
        rconPort: 22,
      }),
    ).toThrow(SsrfError);
    expect(() =>
      adapter.validateConfiguration({
        gameSlug: "rust",
        platformFamily: "PC",
        hostname: "203.0.113.10",
        queryPort: 28015,
        gamePort: 28015,
        rconPort: 28016,
      }),
    ).not.toThrow();
  });
});
