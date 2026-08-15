/**
 * Authoritative game catalogue for the server directory.
 * Slugs must stay aligned with prisma `Game` seed rows where they overlap.
 */
export type DirectoryGame = {
  slug: string;
  name: string;
  platformFamily: "PC" | "CONSOLE" | "BOTH";
  /** Default query adapter key from the registry. */
  adapterKey: string;
};

export const DIRECTORY_GAMES: readonly DirectoryGame[] = [
  { slug: "rust", name: "Rust", platformFamily: "PC", adapterKey: "manual" },
  {
    slug: "minecraft-java",
    name: "Minecraft Java",
    platformFamily: "PC",
    adapterKey: "minecraft-java",
  },
  {
    slug: "ark-survival-ascended",
    name: "ARK: Survival Ascended",
    platformFamily: "PC",
    adapterKey: "manual",
  },
  {
    slug: "ark-survival-evolved",
    name: "ARK: Survival Evolved",
    platformFamily: "PC",
    adapterKey: "manual",
  },
  { slug: "dayz", name: "DayZ", platformFamily: "PC", adapterKey: "manual" },
  { slug: "7-days-to-die", name: "7 Days to Die", platformFamily: "PC", adapterKey: "manual" },
  { slug: "conan-exiles", name: "Conan Exiles", platformFamily: "PC", adapterKey: "manual" },
  { slug: "valheim", name: "Valheim", platformFamily: "PC", adapterKey: "manual" },
  { slug: "unturned", name: "Unturned", platformFamily: "PC", adapterKey: "manual" },
  { slug: "garrys-mod", name: "Garry’s Mod", platformFamily: "PC", adapterKey: "manual" },
  { slug: "sbox", name: "S&Box", platformFamily: "PC", adapterKey: "manual" },
  { slug: "project-zomboid", name: "Project Zomboid", platformFamily: "PC", adapterKey: "manual" },
  { slug: "eco", name: "Eco", platformFamily: "PC", adapterKey: "manual" },
  { slug: "terraria", name: "Terraria", platformFamily: "PC", adapterKey: "manual" },
  { slug: "starbound", name: "Starbound", platformFamily: "PC", adapterKey: "manual" },
  {
    slug: "rust-console",
    name: "Rust Console Edition",
    platformFamily: "CONSOLE",
    adapterKey: "manual",
  },
  {
    slug: "ark-console",
    name: "ARK Console Editions",
    platformFamily: "CONSOLE",
    adapterKey: "manual",
  },
  {
    slug: "conan-exiles-console",
    name: "Conan Exiles Console",
    platformFamily: "CONSOLE",
    adapterKey: "manual",
  },
  {
    slug: "7-days-to-die-console",
    name: "7 Days to Die Console",
    platformFamily: "CONSOLE",
    adapterKey: "manual",
  },
  {
    slug: "minecraft-bedrock",
    name: "Minecraft Bedrock",
    platformFamily: "CONSOLE",
    adapterKey: "manual",
  },
] as const;

/** Legacy marketplace seed alias → directory slug. */
const LEGACY_ALIASES: Record<string, string> = {
  minecraft: "minecraft-java",
  Minecraft: "minecraft-java",
  Rust: "rust",
  DayZ: "dayz",
  "Conan Exiles": "conan-exiles",
  Valheim: "valheim",
  "ARK: Survival Ascended": "ark-survival-ascended",
};

export function findDirectoryGame(input: string): DirectoryGame | undefined {
  const trimmed = input.trim();
  const aliased = LEGACY_ALIASES[trimmed] ?? trimmed.toLowerCase();
  return (
    DIRECTORY_GAMES.find((g) => g.slug === aliased || g.slug === trimmed) ??
    DIRECTORY_GAMES.find((g) => g.name.toLowerCase() === trimmed.toLowerCase())
  );
}

export function resolveGameSlug(input: string): string {
  const game = findDirectoryGame(input);
  if (!game) {
    throw new Error(`Unsupported game: ${input}`);
  }
  return game.slug;
}

export function resolveGameName(slugOrName: string): string {
  return findDirectoryGame(slugOrName)?.name ?? slugOrName;
}
