import type { ServerCapability, ServerOperationalStatus } from "@/features/servers/lib/types";
import type { ResolvedTarget } from "@/features/servers/lib/ssrf";

export type AdapterTargetConfig = {
  gameSlug: string;
  platformFamily: "PC" | "CONSOLE";
  hostname: string | null;
  queryPort: number | null;
  gamePort: number | null;
};

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
};

export type ServerQueryAdapter = {
  key: string;
  supports(gameSlug: string, platformFamily: "PC" | "CONSOLE"): boolean;
  capabilities(gameSlug: string, platformFamily: "PC" | "CONSOLE"): readonly ServerCapability[];
  allowedPorts(): readonly number[];
  validateTarget(config: AdapterTargetConfig): void;
  queryStatus(target: ResolvedTarget, config: AdapterTargetConfig): Promise<NormalizedStatusResult>;
};

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
