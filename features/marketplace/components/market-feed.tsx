import Link from "next/link";
import { LockBodyScroll } from "@/features/marketplace/components/lock-body-scroll";
import { MarketFeedSlide } from "@/features/marketplace/components/market-feed-slide";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";

/**
 * Full-screen, swipe/scroll-snap product feed (TikTok/Stories-style,
 * client spec 2026-08-16) — an alternative to the grid view for the same
 * filtered result set.
 *
 * Positioned `fixed` to the viewport (not the page's own padded/scrolled
 * flow) between the app's sticky header (h-14, see components/koba/
 * app-shell.tsx) and its fixed mobile bottom nav, with LockBodyScroll
 * disabling the underlying page scroll entirely — otherwise the page's
 * own scroll can clip this view's top edge, which is exactly the bug
 * the client caught (title cut off at the top on first ship).
 */
export function MarketFeed({
  items,
  signedIn,
  gridHref,
}: {
  items: PublicProductCard[];
  signedIn: boolean;
  gridHref: string;
}) {
  return (
    <div className="fixed inset-x-0 top-14 bottom-16 z-20 bg-background md:bottom-0">
      <LockBodyScroll />
      <Link
        href={gridHref}
        className="absolute top-3 right-3 z-30 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm"
      >
        Grid view
      </Link>
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No approved listings match these filters.
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-scroll">
          {items.map((product) => (
            <MarketFeedSlide key={product.slug} product={product} signedIn={signedIn} />
          ))}
        </div>
      )}
    </div>
  );
}
