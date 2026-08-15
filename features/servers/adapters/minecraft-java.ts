import type {
  AdapterTargetConfig,
  NormalizedStatusResult,
  ServerQueryAdapter,
} from "@/features/servers/adapters/types";
import { capabilitiesFor } from "@/features/servers/lib/capabilities";
import {
  DEFAULT_QUERY_TIMEOUTS,
  assertAllowedPort,
  assertSafeHostname,
  revalidateResolvedIp,
  type ResolvedTarget,
  SsrfError,
} from "@/features/servers/lib/ssrf";

/** Injectable UDP transport for tests — never call from the browser. */
export type UdpTransport = (opts: {
  ip: string;
  port: number;
  packet: Buffer;
  timeoutMs: number;
  maxResponseBytes: number;
}) => Promise<Buffer>;

const MINECRAFT_JAVA_PORTS = [25565, 25566, 25567, 19132] as const;

/**
 * Minecraft Java Server List Ping (legacy 0xFE) — public query only.
 * No RCON. Production transport must be injected by the polling worker;
 * default transport is intentionally absent in unit tests.
 */
export function createMinecraftJavaAdapter(transport?: UdpTransport): ServerQueryAdapter {
  return {
    key: "minecraft-java",
    supports(gameSlug, platformFamily) {
      return gameSlug === "minecraft-java" && platformFamily === "PC";
    },
    capabilities(gameSlug, platformFamily) {
      return capabilitiesFor(gameSlug, platformFamily).filter(
        (c) => c !== "RCON_READ" && c !== "RCON_WRITE",
      );
    },
    allowedPorts() {
      return MINECRAFT_JAVA_PORTS;
    },
    validateTarget(config: AdapterTargetConfig) {
      if (!config.hostname) {
        throw new SsrfError("Hostname is required for Minecraft Java query.", "EMPTY_HOST");
      }
      assertSafeHostname(config.hostname);
      const port = config.queryPort ?? config.gamePort ?? 25565;
      assertAllowedPort(port, MINECRAFT_JAVA_PORTS);
    },
    async queryStatus(target: ResolvedTarget): Promise<NormalizedStatusResult> {
      if (!transport) {
        return {
          operationalState: "UNKNOWN",
          livePlayers: null,
          maxPlayers: null,
          queue: null,
          mapName: null,
          mapSize: null,
          pingMs: null,
          successful: false,
          errorCategory: "TRANSPORT_UNAVAILABLE",
          source: "minecraft-java",
        };
      }

      const started = Date.now();
      let lastError: string | null = null;

      for (const ip of target.resolvedIps) {
        revalidateResolvedIp(ip);
        try {
          // Legacy server-list ping marker — TCP in production; tests inject responses.
          const packet = Buffer.from([0xfe, 0x01]);
          const response = await transport({
            ip,
            port: target.port,
            packet,
            timeoutMs: DEFAULT_QUERY_TIMEOUTS.totalMs,
            maxResponseBytes: DEFAULT_QUERY_TIMEOUTS.maxResponseBytes,
          });
          if (response.byteLength > DEFAULT_QUERY_TIMEOUTS.maxResponseBytes) {
            throw new Error("RESPONSE_TOO_LARGE");
          }
          const parsed = parseLegacyPing(response);
          return {
            operationalState: "ONLINE",
            livePlayers: parsed.online,
            maxPlayers: parsed.max,
            queue: null,
            mapName: parsed.motd,
            mapSize: null,
            pingMs: Date.now() - started,
            successful: true,
            errorCategory: null,
            source: "minecraft-java",
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : "QUERY_FAILED";
        }
      }

      return {
        operationalState: "UNKNOWN",
        livePlayers: null,
        maxPlayers: null,
        queue: null,
        mapName: null,
        mapSize: null,
        pingMs: null,
        successful: false,
        errorCategory: lastError ?? "QUERY_FAILED",
        source: "minecraft-java",
      };
    },
  };
}

export const minecraftJavaAdapter = createMinecraftJavaAdapter();

/** Parse legacy §1 ping payload (UTF-16BE after 0xFF length). */
export function parseLegacyPing(buf: Buffer): {
  motd: string | null;
  online: number | null;
  max: number | null;
} {
  if (buf.length < 3 || buf[0] !== 0xff) {
    return { motd: null, online: null, max: null };
  }
  const text = buf.slice(3).toString("utf16le");
  const parts = text.split("\u0000");
  // Modernised: §1\0protocol\0version\0motd\0online\0max
  if (parts[0] === "§1" && parts.length >= 6) {
    return {
      motd: parts[3] || null,
      online: Number.parseInt(parts[4] ?? "", 10) || 0,
      max: Number.parseInt(parts[5] ?? "", 10) || 0,
    };
  }
  // Older: motd§online§max
  const legacy = text.split("§");
  if (legacy.length >= 3) {
    return {
      motd: legacy[0] || null,
      online: Number.parseInt(legacy[1] ?? "", 10) || 0,
      max: Number.parseInt(legacy[2] ?? "", 10) || 0,
    };
  }
  return { motd: null, online: null, max: null };
}
