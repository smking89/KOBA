import Link from "next/link";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/features/marketplace/components/favorite-button";
import { ShareButton } from "@/features/marketplace/components/share-button";
import { PlatformIcon } from "@/features/marketplace/components/platform-icon";
import { StarRating } from "@/features/marketplace/components/star-rating";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

/**
 * One full-viewport "slide" in the swipeable feed (features/marketplace's
 * MarketFeed). CSS scroll-snap does the swiping — this slide fills the
 * whole snap area, so its overlaid chrome (action rail, platform row,
 * rating, price/action + copyright footer) reads as fixed in place while
 * that product is on screen: nothing inside a slide scrolls on its own,
 * only snapping to the next slide moves anything (client spec, 2026-08-16).
 */
export function MarketFeedSlide({
  product,
  signedIn,
}: {
  product: PublicProductCard;
  signedIn: boolean;
}) {
  const sold = !product.inStock;
  const actionLabel = sold
    ? "Sold"
    : product.freebiePolicy !== "NONE"
      ? "Claim"
      : product.listingType === "AUCTION"
        ? "Bid"
        : "Buy";
  const displayCents =
    product.listingType === "AUCTION"
      ? (product.auction?.highBidCents ?? product.priceCents)
      : product.priceCents;

  return (
    <section className="relative h-full w-full flex-shrink-0 snap-start bg-white">
      {/* Name banner */}
      <div className="absolute inset-x-4 top-4 z-10 rounded-lg bg-background/90 px-4 py-2 text-center backdrop-blur-sm">
        <Link
          href={`/market/${product.slug}`}
          className="line-clamp-1 text-xl font-extrabold tracking-tight text-foreground hover:text-neon-lime"
        >
          {product.title}
        </Link>
      </div>

      {/* Art fill */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-sm font-semibold tracking-widest text-black/25 uppercase">
          {product.game.name}
        </span>
      </div>

      <div className="absolute top-16 left-4 z-10 flex flex-col gap-1">
        {product.boosted ? (
          <span className="rounded-full bg-neon-lime px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-background uppercase">
            Boosted
          </span>
        ) : null}
        {product.freebiePolicy !== "NONE" ? (
          <span className="rounded-full bg-neon-mint px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-background uppercase">
            Free
          </span>
        ) : null}
      </div>

      {/* Action rail — fixed to this slide's right edge */}
      <div className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col items-center gap-3 rounded-full bg-white/85 p-1.5 backdrop-blur-sm">
        <FavoriteButton slug={product.slug} initialFavorited={product.favorited} signedIn={signedIn} />
        <ShareButton slug={product.slug} title={product.title} />
        <Link
          href="/wallet"
          aria-label="Boost this listing"
          title="Boost"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neon-lime transition-transform hover:scale-110"
        >
          <Zap className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      {/* Seller banner */}
      <div className="absolute top-28 left-4 z-10 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-foreground backdrop-blur-sm">
        {product.seller.shopSlug ? (
          <Link href={`/shops/${product.seller.shopSlug}`} className="hover:text-neon-lime">
            @{product.seller.handle ?? product.seller.displayName}
          </Link>
        ) : (
          <span>@{product.seller.handle ?? product.seller.displayName}</span>
        )}
        {product.seller.verified ? (
          <span
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neon-lime text-[0.6rem] text-background"
            title="Verified seller"
            aria-label="Verified seller"
          >
            ✓
          </span>
        ) : null}
      </div>

      {/* Platform row — fixed bottom-left */}
      <div className="absolute bottom-28 left-4 z-10 flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1.5 backdrop-blur-sm">
        {product.platforms.map((platform) => (
          <PlatformIcon key={platform} platform={platform} className="h-4 w-4 text-black/70" />
        ))}
      </div>

      {/* Star rating — fixed bottom-right */}
      <div className="absolute right-4 bottom-28 z-10 rounded-full bg-white/85 px-2.5 py-1.5 backdrop-blur-sm">
        <StarRating ratingAvg={product.shopRatingAvg} reviewCount={product.shopReviewCount} />
      </div>

      {/* Footer: flavor text + rarity, price/action, copyright — fixed to the bottom of this slide */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 bg-background/95 px-4 pt-3 pb-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <RarityChip rarity={product.rarity} />
          {product.descriptionSnippet ? (
            <p className="line-clamp-1 text-xs text-muted italic">
              &ldquo;{product.descriptionSnippet}&rdquo;
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className={cn("font-mono text-lg text-foreground", sold && "text-muted line-through")}>
              {formatPrice(displayCents, product.currency)}
            </span>
            {product.auction && product.listingType === "AUCTION" ? (
              <p className="font-mono text-[0.65rem] text-neon-lime">
                <AuctionCountdown endsAt={product.auction.endsAt} />
              </p>
            ) : null}
          </div>
          {sold ? (
            <Button variant="secondary" size="sm" disabled>
              {actionLabel}
            </Button>
          ) : (
            <Link href={`/market/${product.slug}`}>
              <Button size="sm">{actionLabel}</Button>
            </Link>
          )}
        </div>
        <p className="flex items-center justify-between font-mono text-[0.6rem] text-muted">
          <span>© {new Date().getFullYear()} koba.games. All rights reserved.</span>
          <span>{product.seller.kobaId ?? product.slug}</span>
        </p>
      </div>
    </section>
  );
}
