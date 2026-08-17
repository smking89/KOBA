import type { DevProductCategory } from "@/lib/generated/prisma/client";

export const DEV_PRODUCT_CATEGORY_LABEL: Record<DevProductCategory, string> = {
  DISCORD_BOT: "Discord bot",
  GAME_SERVER_PLUGIN: "Game-server plugin",
  SERVER_MANAGEMENT: "Server tool",
  INTEGRATION: "Integration",
  DOWNLOADABLE_PACK: "Asset pack",
  API_SERVICE: "API service",
  UTILITY: "Utility",
  THEME: "Theme",
};

export const DEV_PRODUCT_CATEGORIES = Object.keys(
  DEV_PRODUCT_CATEGORY_LABEL,
) as DevProductCategory[];

export function categoryLabel(category: DevProductCategory): string {
  return DEV_PRODUCT_CATEGORY_LABEL[category];
}
