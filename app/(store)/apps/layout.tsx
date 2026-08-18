import Link from "next/link";
import { auth } from "@/lib/auth";
import { BrandMark } from "@/components/koba/brand-mark";
import { ThemeToggle } from "@/components/koba/theme-toggle";

/**
 * Standalone shell for the KOBA App Store (app.koba.games, Phase 20/21/
 * 22) — its own layout/navigation (no shared AppShell sidebar), but the
 * same global color tokens and dark/light toggle as the rest of the
 * platform (client, 2026-08-17: "the app store, koba.games,
 * admin.koba.games, developer.koba.games all need to follow the same
 * color scheme...black and white"). What makes this "its own GUI/UX" is
 * structure — its own header, its own storefront layout — not a
 * separate palette.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/apps" className="flex items-center gap-2">
            <BrandMark href={null} showWordmark={false} size={28} />
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              KOBA App Store
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/developers" className="text-muted hover:text-foreground">
              Developers
            </Link>
            <Link href="/" className="text-muted hover:text-foreground">
              koba.games
            </Link>
            <ThemeToggle />
            {session?.user.id ? (
              <Link
                href="/library/apps"
                className="rounded-full bg-foreground px-4 py-1.5 font-semibold text-background"
              >
                My apps
              </Link>
            ) : (
              <Link
                href="/login?callbackUrl=/apps"
                className="rounded-full bg-foreground px-4 py-1.5 font-semibold text-background"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted sm:px-6">
        Third-party software is not guaranteed safe. KOBA never executes uploaded plugin code.
      </footer>
    </div>
  );
}
