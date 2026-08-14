import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env";
import { kobaTokens } from "@/lib/design-tokens";

export default function manifest(): MetadataRoute.Manifest {
  const env = getPublicEnv();

  return {
    id: "/",
    name: env.appName,
    short_name: env.appName,
    description:
      "Infinite-scrolling social marketplace for game-server communities. Trade assets, find squads, and build on one KOBAID.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: kobaTokens.background,
    theme_color: kobaTokens.themeColor,
    categories: ["games", "social", "shopping"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
