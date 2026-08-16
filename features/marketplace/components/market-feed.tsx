import { MarketFeedSlide } from "@/features/marketplace/components/market-feed-slide";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";

/**
 * Full-screen, swipe/scroll-snap product feed (TikTok/Stories-style,
 * client spec 2026-08-16) — an alternative to the grid view for the same
 * filtered result set. Sits below the app's sticky header and above its
 * fixed mobile bottom nav (both stay put; only the active slide changes).
 */
export function MarketFeed({ items, signedIn }: { items: PublicProductCard[]; signedIn: boolean }) {
  if (items.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-11.5rem)] items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted md:h-[calc(100dvh-3.5rem)]">
        No approved listings match these filters.
      </div>
    );
  }

  return (
    <div className="-mx-4 h-[calc(100dvh-11.5rem)] snap-y snap-mandatory overflow-y-scroll md:mx-0 md:h-[calc(100dvh-3.5rem)] md:rounded-lg">
      {items.map((product) => (
        <MarketFeedSlide key={product.slug} product={product} signedIn={signedIn} />
      ))}
    </div>
  );
}
