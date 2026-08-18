import type { Metadata, Viewport } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { PwaClientLayer } from "@/components/koba/pwa-client-layer";
import { AuthSessionProvider } from "@/components/koba/session-provider";
import { ThemeScript } from "@/components/koba/theme-script";
import { getPublicEnv } from "@/lib/env";
import { kobaTokens } from "@/lib/design-tokens";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const env = getPublicEnv();

export const metadata: Metadata = {
  title: {
    default: env.appName,
    template: `%s · ${env.appName}`,
  },
  description:
    "Infinite-scrolling social marketplace for game-server communities. Trade assets, find squads, and build on one KOBAID.",
  applicationName: env.appName,
  metadataBase: new URL(env.appUrl),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      // OS-level dark/light favicon variants (client, 2026-08-18 —
      // updated logo/favicon art). Only responds to the OS preference,
      // not KOBA's own in-page toggle — theme-script.tsx / theme-toggle.tsx
      // swap the live <link> href to track the manual toggle too.
      { url: "/favicon-dark.png", sizes: "64x64", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.png", sizes: "64x64", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: env.appName,
  },
};

export const viewport: Viewport = {
  themeColor: kobaTokens.themeColor,
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Real light/dark toggle (client, 2026-08-17), shared across the whole
  // site and every subdomain. Reading the cookie server-side means the
  // very first HTML response already carries the right `data-theme` —
  // ThemeScript (inline, blocking, in <head>) only has to correct for a
  // stale/missing cookie (private/incognito, first-ever visit), not do
  // all the work itself, so there's no flash on normal navigation.
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("koba-theme")?.value;
  const theme = savedTheme === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${sora.variable} ${plexMono.variable} ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        <AuthSessionProvider>
          <PwaClientLayer>{children}</PwaClientLayer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
