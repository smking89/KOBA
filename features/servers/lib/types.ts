export const SERVER_CAPABILITIES = [
  "STATUS",
  "PLAYER_COUNT",
  "PLAYER_LIST",
  "QUEUE_COUNT",
  "MAP_INFO",
  "RCON_READ",
  "RCON_WRITE",
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

export type GameServerView = {
  publicRef: string;
  slug: string;
  name: string;
  game: string;
  platformFamily: "PC" | "CONSOLE";
  region: string;
  tags: string[];
  ownerHandle: string;
  linkedShopSlug: string | null;
  joinInfo: string | null;
  lastRefreshAt: string | null;
  capabilities: readonly ServerCapability[];
  /** "Rarity" for a server, per client clarification: derived from a Map
   * the owner purchased on KOBA and marked active on this server — null
   * when no active map is set, never a guessed/default tier. */
  activeMapRarity: string | null;
  activeMapTitle: string | null;
  /** Only populate fields the server capabilities allow. */
  status?: "ONLINE" | "OFFLINE" | "UNKNOWN";
  livePlayers?: number;
  maxPlayers?: number;
  queue?: number;
  mapName?: string;
  mapSize?: string;
  pingMs?: number;
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
  if (!hasCapability(server, "PLAYER_COUNT")) return null;
  return server.livePlayers ?? null;
}

export function visibleQueue(server: GameServerView): number | null {
  if (!hasCapability(server, "QUEUE_COUNT")) return null;
  return server.queue ?? null;
}

export function visibleMap(server: GameServerView): { name?: string; size?: string } | null {
  if (!hasCapability(server, "MAP_INFO")) return null;
  const map: { name?: string; size?: string } = {};
  if (server.mapName) map.name = server.mapName;
  if (server.mapSize) map.size = server.mapSize;
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
