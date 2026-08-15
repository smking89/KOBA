import { manualAdapter } from "@/features/servers/adapters/manual";
import { minecraftJavaAdapter } from "@/features/servers/adapters/minecraft-java";
import { rustAdapter } from "@/features/servers/adapters/rust";
import type { ServerQueryAdapter } from "@/features/servers/adapters/types";
import { findDirectoryGame } from "@/features/servers/lib/game-catalogue";

const ADAPTERS: ServerQueryAdapter[] = [rustAdapter, minecraftJavaAdapter, manualAdapter];

export function getAdapter(key: string): ServerQueryAdapter {
  return ADAPTERS.find((a) => a.key === key) ?? manualAdapter;
}

export function resolveAdapterKey(
  gameSlugOrName: string,
  platformFamily: "PC" | "CONSOLE",
): string {
  const game = findDirectoryGame(gameSlugOrName);
  if (!game) return "manual";
  if (platformFamily === "CONSOLE") return "manual";
  const preferred = ADAPTERS.find(
    (a) => a.supports(game.slug, platformFamily) && a.key !== "manual",
  );
  return preferred?.key ?? game.adapterKey;
}

export function listAdapters(): readonly ServerQueryAdapter[] {
  return ADAPTERS;
}
