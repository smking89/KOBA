import type { Metadata, Viewport } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import { PwaClientLayer } from "@/components/koba/pwa-client-layer";
import { AuthSessionProvider } from "@/components/koba/session-provider";
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
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${plexMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <AuthSessionProvider>
          <PwaClientLayer>{children}</PwaClientLayer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
