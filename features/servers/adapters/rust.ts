import type {
  AdapterTargetConfig,
  NormalizedStatusResult,
  ReadOnlyIntegrationAdapter,
  StatusFieldPresence,
} from "@/features/servers/adapters/types";
import { unsupportedResult } from "@/features/servers/adapters/types";
import { a2sToStatus, queryA2sInfo, type A2sTransport } from "@/features/servers/adapters/rust-a2s";
import {
  queryWebRconServerInfo,
  type WebRconTransport,
} from "@/features/servers/adapters/rust-webrcon";
import { capabilitiesFor } from "@/features/servers/lib/capabilities";
import { classifyTransportError } from "@/features/servers/lib/integration-errors";
import { rustAllowedPorts } from "@/features/servers/lib/rust-ports";
import type { ServerCapability } from "@/features/servers/lib/types";
import { assertAllowedPort, assertSafeHostname, SsrfError } from "@/features/servers/lib/ssrf";

const RUST_IMPLEMENTED: readonly ServerCapability[] = [
  "STATUS",
  "PLAYER_COUNT",
  "QUEUE_COUNT",
  "MAP_INFO",
  "PING",
  "PUBLIC_QUERY",
  "RCON_READ",
  "PC",
  "JOIN_LINK",
];

export type RustAdapterDeps = {
  a2sTransport?: A2sTransport;
  webrconTransport?: WebRconTransport;
};

function emptyPresence(state: StatusFieldPresence) {
  return {
    livePlayers: state,
    maxPlayers: state,
    queue: state,
    mapName: state,
    mapSize: "UNSUPPORTED" as const,
    pingMs: state,
    serverName: state,
    serverTags: state,
    rustVersion: state,
  };
}

export function createRustAdapter(deps: RustAdapterDeps = {}): ReadOnlyIntegrationAdapter {
  const allowed = rustAllowedPorts();

  const adapter: ReadOnlyIntegrationAdapter = {
    key: "rust",
    supports(gameSlug, platformFamily) {
      return gameSlug === "rust" && platformFamily === "PC";
    },
    capabilities(gameSlug, platformFamily) {
      return capabilitiesFor(gameSlug, platformFamily).filter((cap) =>
        RUST_IMPLEMENTED.includes(cap),
      );
    },
    allowedPorts() {
      return allowed;
    },
    validateTarget(config: AdapterTargetConfig) {
      adapter.validateConfiguration(config);
    },
    validateConfiguration(config: AdapterTargetConfig & { rconPort?: number }) {
      if (!config.hostname) {
        throw new SsrfError("Hostname is required for Rust PC.", "EMPTY_HOST");
      }
      assertSafeHostname(config.hostname);
      const queryPort = config.queryPort ?? config.gamePort;
      if (queryPort != null) assertAllowedPort(queryPort, allowed);
      if (config.gamePort != null) assertAllowedPort(config.gamePort, allowed);
      if (config.rconPort != null) assertAllowedPort(config.rconPort, allowed);
    },
    getCapabilities(gameSlug, platformFamily) {
      return adapter.capabilities(gameSlug, platformFamily);
    },
    async queryStatus(target, config) {
      return adapter.queryPublicStatus(target, config);
    },
    async queryPublicStatus(target) {
      if (!deps.a2sTransport) {
        return {
          ...unsupportedResult("rust-a2s", "TRANSPORT_UNAVAILABLE"),
          fieldPresence: emptyPresence("FAILED"),
        };
      }
      const { info, pingMs, error } = await queryA2sInfo(target, deps.a2sTransport);
      return a2sToStatus(info, pingMs, error);
    },
    async queryReadOnlyStatus(target, config) {
      return queryWebRconServerInfo(target, {
        password: config.password,
        hostHeader: `${config.hostname}:${config.rconPort}`,
        ...(deps.webrconTransport ? { transport: deps.webrconTransport } : {}),
      });
    },
    async testConnection(target, config) {
      return adapter.queryReadOnlyStatus(target, config);
    },
    normalizeResponse(input) {
      return {
        operationalState: input.operationalState ?? "UNKNOWN",
        livePlayers: input.livePlayers ?? null,
        maxPlayers: input.maxPlayers ?? null,
        queue: input.queue ?? null,
        mapName: input.mapName ?? null,
        mapSize: null,
        pingMs: input.pingMs ?? null,
        successful: input.successful ?? false,
        errorCategory: input.errorCategory ?? null,
        source: input.source,
        serverName: input.serverName ?? null,
        serverTags: input.serverTags ?? null,
        rustVersion: input.rustVersion ?? null,
        fieldPresence:
          input.fieldPresence ?? emptyPresence(input.successful ? "AVAILABLE" : "FAILED"),
      };
    },
    classifyError(error: unknown) {
      return classifyTransportError(error);
    },
    async disconnect() {
      // Connections are request-scoped; native transport destroys the socket.
    },
  };

  return adapter;
}

/** Production adapter — public query and RCON transports are injected by the worker. */
export const rustAdapter = createRustAdapter();

export function mergePublicAndRcon(
  publicStatus: NormalizedStatusResult,
  rconStatus: NormalizedStatusResult | null,
): NormalizedStatusResult {
  const pick = <T>(
    preferred: T | null | undefined,
    fallback: T | null | undefined,
    preferredState?: StatusFieldPresence,
  ): T | null => {
    if (preferredState === "AVAILABLE" && preferred != null) return preferred;
    if (preferred != null) return preferred;
    return fallback ?? null;
  };

  const rcon = rconStatus;
  const successful = Boolean(publicStatus.successful || rcon?.successful);
  return {
    operationalState: rcon?.successful
      ? rcon.operationalState
      : publicStatus.successful
        ? publicStatus.operationalState
        : "UNKNOWN",
    livePlayers: pick(
      rcon?.livePlayers,
      publicStatus.livePlayers,
      rcon?.fieldPresence?.livePlayers,
    ),
    maxPlayers: pick(rcon?.maxPlayers, publicStatus.maxPlayers, rcon?.fieldPresence?.maxPlayers),
    queue: pick(rcon?.queue, publicStatus.queue, rcon?.fieldPresence?.queue),
    mapName: pick(rcon?.mapName, publicStatus.mapName, rcon?.fieldPresence?.mapName),
    mapSize: null,
    pingMs: publicStatus.pingMs,
    successful,
    errorCategory: successful ? null : (rcon?.errorCategory ?? publicStatus.errorCategory),
    source:
      rcon?.successful && publicStatus.successful ? "rust" : (rcon?.source ?? publicStatus.source),
    serverName: pick(rcon?.serverName, publicStatus.serverName, rcon?.fieldPresence?.serverName),
    serverTags: publicStatus.serverTags ?? rcon?.serverTags ?? null,
    rustVersion: publicStatus.rustVersion ?? null,
    fieldPresence: {
      livePlayers:
        rcon?.fieldPresence?.livePlayers === "AVAILABLE"
          ? "AVAILABLE"
          : (publicStatus.fieldPresence?.livePlayers ?? "FAILED"),
      maxPlayers:
        rcon?.fieldPresence?.maxPlayers === "AVAILABLE"
          ? "AVAILABLE"
          : (publicStatus.fieldPresence?.maxPlayers ?? "FAILED"),
      queue:
        rcon?.fieldPresence?.queue === "AVAILABLE"
          ? "AVAILABLE"
          : (publicStatus.fieldPresence?.queue ?? "UNSUPPORTED"),
      mapName:
        rcon?.fieldPresence?.mapName === "AVAILABLE"
          ? "AVAILABLE"
          : (publicStatus.fieldPresence?.mapName ?? "FAILED"),
      mapSize: "UNSUPPORTED",
      pingMs: publicStatus.fieldPresence?.pingMs ?? "UNSUPPORTED",
      serverName:
        rcon?.fieldPresence?.serverName === "AVAILABLE"
          ? "AVAILABLE"
          : (publicStatus.fieldPresence?.serverName ?? "FAILED"),
      serverTags: publicStatus.fieldPresence?.serverTags ?? "UNSUPPORTED",
      rustVersion: publicStatus.fieldPresence?.rustVersion ?? "UNSUPPORTED",
    },
  };
}
