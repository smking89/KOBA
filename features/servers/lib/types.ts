export const SERVER_CAPABILITIES = [
  "STATUS",
  "PLAYER_COUNT",
  "PLAYER_LIST",
  "QUEUE_COUNT",
  "MAP_INFO",
  "MAP_SIZE",
  "PING",
  "PUBLIC_QUERY",
  "RCON_READ",
  "RCON_WRITE",
  "JOIN_LINK",
  "PC",
  "CONSOLE",
] as const;

export type ServerCapability = (typeof SERVER_CAPABILITIES)[number];

export const RCON_TEST_STATES = [
  "IDLE",
  "TESTING",
  "SUCCESS",
  "TIMEOUT",
  "AUTH_FAILED",
  "UNSUPPORTED",
] as const;

export type RconTestState = (typeof RCON_TEST_STATES)[number];

export const SERVER_VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export type ServerVerificationStatus = (typeof SERVER_VERIFICATION_STATUSES)[number];

export const SERVER_PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED", "SUSPENDED", "ARCHIVED"] as const;
export type ServerPublicationStatus = (typeof SERVER_PUBLICATION_STATUSES)[number];

export const SERVER_OPERATIONAL_STATUSES = ["ONLINE", "OFFLINE", "DEGRADED", "UNKNOWN"] as const;
export type ServerOperationalStatus = (typeof SERVER_OPERATIONAL_STATUSES)[number];

/** How a metric should render when capabilities / freshness differ. */
export const METRIC_DISPLAY_STATES = [
  "AVAILABLE",
  "NOT_SUPPORTED",
  "TEMPORARILY_UNAVAILABLE",
  "STALE",
  "UNKNOWN",
] as const;
export type MetricDisplayState = (typeof METRIC_DISPLAY_STATES)[number];

export type FreshnessMeta = {
  checkedAt: string | null;
  lastSuccessfulAt: string | null;
  freshUntil: string | null;
  isStale: boolean;
  source: string;
};

export type GameServerView = {
  publicRef: string;
  slug: string;
  name: string;
  description: string | null;
  game: string;
  gameSlug: string;
  platformFamily: "PC" | "CONSOLE";
  region: string;
  country: string | null;
  tags: string[];
  ownerHandle: string;
  ownerAccountType: "BUSINESS" | "INFLUENCER" | string;
  linkedShopSlug: string | null;
  joinInfo: string | null;
  /** Hostname-only public join target — never includes resolved private IPs. */
  displayHost: string | null;
  verificationStatus: ServerVerificationStatus;
  publicationStatus: ServerPublicationStatus;
  favouriteCount?: number;
  favouritedByMe?: boolean;
  capabilities: readonly ServerCapability[];
  freshness: FreshnessMeta;
  /** Only populate fields the server capabilities allow and that are fresh. */
  status?: ServerOperationalStatus;
  statusState: MetricDisplayState;
  livePlayers?: number;
  maxPlayers?: number;
  playersState: MetricDisplayState;
  queue?: number;
  queueState: MetricDisplayState;
  mapName?: string;
  mapSize?: string;
  mapState: MetricDisplayState;
  pingMs?: number;
  pingState: MetricDisplayState;
};

export type GameServerOwnerView = GameServerView & {
  adapterKey: string;
  hostname: string | null;
  queryPort: number | null;
  gamePort: number | null;
  hideResolvedIp: boolean;
  verificationToken: string | null;
  verificationNote: string | null;
  pollFailures: number;
  nextPollAt: string | null;
  rconConfigured: boolean;
  rconTestState: RconTestState;
};

export type RustIntegrationHealth = {
  configured: boolean;
  credentialsConfigured: boolean;
  status: string;
  mode: "RCON_READ" | "PUBLIC_QUERY";
  readOnly: true;
  administrativeCommandsEnabled: false;
  hostname: string | null;
  queryPort: number | null;
  rconPort: number | null;
  capabilities: readonly ServerCapability[];
  lastTestedAt: string | null;
  lastSuccessfulAt: string | null;
  lastFailureCategory: string | null;
  circuitOpen: boolean;
  pollFailures: number;
  freshness: FreshnessMeta;
  online: boolean | null;
  livePlayers: number | null;
  maxPlayers: number | null;
  queue: number | null;
  mapName: string | null;
  mapSize: null;
  serverName: string | null;
  serverTags: string[] | null;
  rustVersion: string | null;
  notices: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

export function canConnectGameServer(accountType: string | null | undefined): boolean {
  return accountType === "BUSINESS" || accountType === "INFLUENCER";
}

export function hasCapability(
  server: Pick<GameServerView, "capabilities">,
  capability: ServerCapability,
): boolean {
  return server.capabilities.includes(capability);
}

/** Never invent unsupported metrics — return null when capability is missing. */
export function visiblePlayerCount(server: GameServerView): number | null {
  if (server.playersState !== "AVAILABLE" && server.playersState !== "STALE") return null;
  if (!hasCapability(server, "PLAYER_COUNT")) return null;
  return server.livePlayers ?? null;
}

export function visibleQueue(server: GameServerView): number | null {
  if (server.queueState !== "AVAILABLE" && server.queueState !== "STALE") return null;
  if (!hasCapability(server, "QUEUE_COUNT")) return null;
  return server.queue ?? null;
}

export function visibleMap(server: GameServerView): { name?: string; size?: string } | null {
  if (server.mapState === "NOT_SUPPORTED") return null;
  if (!hasCapability(server, "MAP_INFO") && !hasCapability(server, "MAP_SIZE")) return null;
  const map: { name?: string; size?: string } = {};
  if (server.mapName) map.name = server.mapName;
  if (server.mapSize) map.size = server.mapSize;
  if (!map.name && !map.size) return null;
  return map;
}

export function rconTestLabel(state: RconTestState): string {
  switch (state) {
    case "IDLE":
      return "Not tested";
    case "TESTING":
      return "Testing connection…";
    case "SUCCESS":
      return "Connected";
    case "TIMEOUT":
      return "Timed out";
    case "AUTH_FAILED":
      return "Authentication failed";
    case "UNSUPPORTED":
      return "Unsupported for this game/platform";
    default:
      return state;
  }
}

export function metricStateLabel(state: MetricDisplayState): string {
  switch (state) {
    case "AVAILABLE":
      return "Live";
    case "NOT_SUPPORTED":
      return "Not supported";
    case "TEMPORARILY_UNAVAILABLE":
      return "Temporarily unavailable";
    case "STALE":
      return "Stale";
    case "UNKNOWN":
      return "Unknown";
    default:
      return state;
  }
}
