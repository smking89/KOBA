import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";

/**
 * Standalone shell for the KOBA App Store (app.koba.games, Phase 20/21/
 * 22) — deliberately its own GUI/UI/UX (client, 2026-08-17), not KOBA's
 * dark AppShell sidebar. Lives in its own `(store)` route group
 * specifically so it renders without `app/(app)/layout.tsx`'s AppShell.
 * Visual identity is scoped entirely through the `.koba-store` class
 * (app/globals.css) — a real light theme, not a dark-mode override.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    // flex-col + min-h-dvh (not min-h-screen/100vh, which can fall short
    // of body's own min-height: 100dvh) so this fills the full viewport
    // regardless of content length — otherwise body's dark background
    // (app/globals.css, the rest of KOBA is dark-only) shows through
    // below short pages like an empty search result.
    <div className="koba-store flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--store-border)] bg-[var(--store-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/apps" className="flex items-center gap-2">
            <Image src="/brand/koba-logo.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-[15px] font-bold tracking-tight text-[var(--store-ink)]">
              KOBA App Store
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/developers" className="text-[var(--store-ink-dim)] hover:text-[var(--store-ink)]">
              Developers
            </Link>
            <Link href="/" className="text-[var(--store-ink-dim)] hover:text-[var(--store-ink)]">
              koba.games
            </Link>
            {session?.user.id ? (
              <Link
                href="/library/apps"
                className="rounded-full bg-[var(--store-ink)] px-4 py-1.5 font-semibold text-white"
              >
                My apps
              </Link>
            ) : (
              <Link
                href="/login?callbackUrl=/apps"
                className="rounded-full bg-[var(--store-accent)] px-4 py-1.5 font-semibold text-[var(--store-accent-ink)]"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-[var(--store-border)] px-4 py-6 text-center text-xs text-[var(--store-ink-faint)] sm:px-6">
        Third-party software is not guaranteed safe. KOBA never executes uploaded plugin code.
      </footer>
    </div>
  );
}
