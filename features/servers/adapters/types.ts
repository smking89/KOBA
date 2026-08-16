import type { ServerCapability, ServerOperationalStatus } from "@/features/servers/lib/types";
import type { ResolvedTarget } from "@/features/servers/lib/ssrf";

export type AdapterTargetConfig = {
  gameSlug: string;
  platformFamily: "PC" | "CONSOLE";
  hostname: string | null;
  queryPort: number | null;
  gamePort: number | null;
};

export type StatusFieldPresence = "AVAILABLE" | "UNSUPPORTED" | "FAILED";

export type NormalizedStatusResult = {
  operationalState: ServerOperationalStatus;
  livePlayers: number | null;
  maxPlayers: number | null;
  queue: number | null;
  mapName: string | null;
  mapSize: string | null;
  pingMs: number | null;
  successful: boolean;
  errorCategory: string | null;
  source: string;
  serverName?: string | null;
  serverTags?: string[] | null;
  rustVersion?: string | null;
  fieldPresence?: {
    livePlayers: StatusFieldPresence;
    maxPlayers: StatusFieldPresence;
    queue: StatusFieldPresence;
    mapName: StatusFieldPresence;
    mapSize: StatusFieldPresence;
    pingMs: StatusFieldPresence;
    serverName: StatusFieldPresence;
    serverTags: StatusFieldPresence;
    rustVersion: StatusFieldPresence;
  };
};

export type ServerQueryAdapter = {
  key: string;
  supports(gameSlug: string, platformFamily: "PC" | "CONSOLE"): boolean;
  capabilities(gameSlug: string, platformFamily: "PC" | "CONSOLE"): readonly ServerCapability[];
  allowedPorts(): readonly number[];
  validateTarget(config: AdapterTargetConfig): void;
  queryStatus(target: ResolvedTarget, config: AdapterTargetConfig): Promise<NormalizedStatusResult>;
};

export type RustConnectionConfig = AdapterTargetConfig & {
  rconPort: number;
  password: string;
};

export type ReadOnlyIntegrationAdapter = ServerQueryAdapter & {
  validateConfiguration(config: AdapterTargetConfig & { rconPort?: number }): void;
  testConnection(
    target: ResolvedTarget,
    config: RustConnectionConfig,
  ): Promise<NormalizedStatusResult>;
  getCapabilities(gameSlug: string, platformFamily: "PC" | "CONSOLE"): readonly ServerCapability[];
  queryPublicStatus(
    target: ResolvedTarget,
    config: AdapterTargetConfig,
  ): Promise<NormalizedStatusResult>;
  queryReadOnlyStatus(
    target: ResolvedTarget,
    config: RustConnectionConfig,
  ): Promise<NormalizedStatusResult>;
  normalizeResponse(
    input: Partial<NormalizedStatusResult> & { source: string },
  ): NormalizedStatusResult;
  classifyError(error: unknown): string;
  disconnect(): Promise<void>;
};

export function isReadOnlyIntegrationAdapter(
  adapter: ServerQueryAdapter,
): adapter is ReadOnlyIntegrationAdapter {
  return (
    typeof (adapter as ReadOnlyIntegrationAdapter).testConnection === "function" &&
    typeof (adapter as ReadOnlyIntegrationAdapter).queryReadOnlyStatus === "function"
  );
}

export function unsupportedResult(
  source: string,
  errorCategory = "UNSUPPORTED",
): NormalizedStatusResult {
  return {
    operationalState: "UNKNOWN",
    livePlayers: null,
    maxPlayers: null,
    queue: null,
    mapName: null,
    mapSize: null,
    pingMs: null,
    successful: false,
    errorCategory,
    source,
  };
}
