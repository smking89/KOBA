import type { ServerCapability } from "@/features/servers/lib/types";
import { findDirectoryGame } from "@/features/servers/lib/game-catalogue";

/**
 * Authoritative capability matrix by game slug + platform family.
 * Adapters may declare a subset; the registry never invents extra capabilities.
 */
const BASE_PC: ServerCapability[] = ["PC", "STATUS", "JOIN_LINK"];
const BASE_CONSOLE: ServerCapability[] = ["CONSOLE", "STATUS", "JOIN_LINK"];

const MATRIX: Record<string, Partial<Record<"PC" | "CONSOLE", readonly ServerCapability[]>>> = {
  rust: {
    PC: [
      ...BASE_PC,
      "PLAYER_COUNT",
      "QUEUE_COUNT",
      "MAP_INFO",
      "PING",
      "PUBLIC_QUERY",
      "RCON_READ",
    ],
  },
  "minecraft-java": {
    PC: [...BASE_PC, "PLAYER_COUNT", "PLAYER_LIST", "PING", "PUBLIC_QUERY", "MAP_INFO"],
  },
  "ark-survival-ascended": {
    PC: [...BASE_PC, "PLAYER_COUNT", "MAP_INFO", "PUBLIC_QUERY", "RCON_READ", "RCON_WRITE"],
  },
  "ark-survival-evolved": {
    PC: [...BASE_PC, "PLAYER_COUNT", "MAP_INFO", "PUBLIC_QUERY", "RCON_READ", "RCON_WRITE"],
  },
  dayz: {
    PC: [...BASE_PC, "PLAYER_COUNT", "MAP_INFO", "PUBLIC_QUERY"],
  },
  "7-days-to-die": {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY", "RCON_READ"],
  },
  "conan-exiles": {
    PC: [...BASE_PC, "PLAYER_COUNT", "MAP_INFO", "PUBLIC_QUERY", "RCON_READ"],
  },
  valheim: {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY"],
  },
  unturned: {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY"],
  },
  "garrys-mod": {
    PC: [...BASE_PC, "PLAYER_COUNT", "MAP_INFO", "PUBLIC_QUERY"],
  },
  sbox: {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY"],
  },
  "project-zomboid": {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY"],
  },
  eco: {
    PC: [...BASE_PC, "PLAYER_COUNT", "PUBLIC_QUERY"],
  },
  terraria: {
    PC: [...BASE_PC, "PLAYER_COUNT"],
  },
  starbound: {
    PC: [...BASE_PC, "PLAYER_COUNT"],
  },
  "rust-console": {
    CONSOLE: [...BASE_CONSOLE],
  },
  "ark-console": {
    CONSOLE: [...BASE_CONSOLE],
  },
  "conan-exiles-console": {
    CONSOLE: [...BASE_CONSOLE],
  },
  "7-days-to-die-console": {
    CONSOLE: [...BASE_CONSOLE],
  },
  "minecraft-bedrock": {
    CONSOLE: [...BASE_CONSOLE, "PLAYER_COUNT"],
  },
};

export function capabilitiesFor(
  gameSlugOrName: string,
  platformFamily: "PC" | "CONSOLE",
): readonly ServerCapability[] {
  const game = findDirectoryGame(gameSlugOrName);
  const slug = game?.slug ?? gameSlugOrName;
  const row = MATRIX[slug]?.[platformFamily];
  if (row) return row;
  return platformFamily === "PC" ? BASE_PC : BASE_CONSOLE;
}

export function supportsCapability(
  gameSlugOrName: string,
  platformFamily: "PC" | "CONSOLE",
  capability: ServerCapability,
): boolean {
  return capabilitiesFor(gameSlugOrName, platformFamily).includes(capability);
}
