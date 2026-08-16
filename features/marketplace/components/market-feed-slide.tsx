import Link from "next/link";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/features/marketplace/components/favorite-button";
import { ShareButton } from "@/features/marketplace/components/share-button";
import { PlatformIcon } from "@/features/marketplace/components/platform-icon";
import { StarRating } from "@/features/marketplace/components/star-rating";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice, type ProductRarity } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

// Rarity-tinted radial backdrop — stands in for a real product photo
// (none exist yet) without ever reading as a broken/empty box. Reuses
// the same rarity color tokens as RarityChip/product-card.
const backdropClass: Record<ProductRarity, string> = {
  COMMON: "from-rarity-common/35",
  UNCOMMON: "from-rarity-uncommon/35",
  RARE: "from-rarity-rare/35",
  EPIC: "from-rarity-epic/35",
  LEGENDARY: "from-rarity-legendary/35",
  RELIC: "from-rarity-relic/40",
};

/**
 * One full-viewport slide in the swipeable feed (features/marketplace's
 * MarketFeed). Layout follows the standard short-form-feed safe zones
 * (TikTok/Reels convention: ~120px right-edge action column, bottom
 * ~30% reserved for a single caption sheet) rather than scattering
 * separate floating pills, so it reads as one coherent screen instead
 * of loose UI fragments over empty space (client feedback, 2026-08-16).
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
    <section className="relative h-full w-full flex-shrink-0 snap-start overflow-hidden bg-background">
      {/* Backdrop fill — rarity-tinted radial gradient, not a blank box */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-background",
          backdropClass[product.rarity],
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-sm font-semibold tracking-[0.3em] text-foreground/15 uppercase">
          {product.game.name}
        </span>
      </div>

      {product.boosted || product.freebiePolicy !== "NONE" ? (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
          {product.boosted ? (
            <span className="rounded-full bg-neon-lime px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-background uppercase shadow-soft">
              Boosted
            </span>
          ) : null}
          {product.freebiePolicy !== "NONE" ? (
            <span className="rounded-full bg-neon-mint px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-background uppercase shadow-soft">
              Free
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Right action column — safe-zone convention, one tight group */}
      <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <FavoriteButton slug={product.slug} initialFavorited={product.favorited} signedIn={signedIn} />
        <ShareButton
          slug={product.slug}
          title={product.title}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-soft hover:text-neon-lime"
        />
        <Link
          href="/wallet"
          aria-label="Boost this listing"
          title="Boost"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-neon-lime shadow-soft transition-transform hover:scale-105"
        >
          <Zap className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      {/* Single caption sheet — everything else lives here, one block */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 rounded-t-2xl border-t border-border bg-background/95 px-4 pt-4 pb-5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {product.seller.shopSlug ? (
            <Link
              href={`/shops/${product.seller.shopSlug}`}
              className="font-semibold hover:text-neon-lime"
            >
              @{product.seller.handle ?? product.seller.displayName}
            </Link>
          ) : (
            <span className="font-semibold">@{product.seller.handle ?? product.seller.displayName}</span>
          )}
          {product.seller.verified ? (
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neon-lime text-[0.6rem] text-background"
              title="Verified seller"
              aria-label="Verified seller"
            >
              ✓
            </span>
          ) : null}
          <StarRating
            ratingAvg={product.shopRatingAvg}
            reviewCount={product.shopReviewCount}
            className="ml-auto"
          />
        </div>

        <Link href={`/market/${product.slug}`} className="block text-lg font-bold hover:text-neon-lime">
          {product.title}
        </Link>

        {product.descriptionSnippet ? (
          <p className="line-clamp-2 text-sm text-muted italic">
            &ldquo;{product.descriptionSnippet}&rdquo;
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <RarityChip rarity={product.rarity} />
          {product.platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border"
            >
              <PlatformIcon platform={platform} className="h-3.5 w-3.5 text-foreground/80" />
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <span className={cn("font-mono text-xl font-semibold", sold && "text-muted line-through")}>
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

        <p className="text-center font-mono text-[0.6rem] text-muted/70">
          © {new Date().getFullYear()} koba.games · {product.seller.kobaId ?? product.slug}
        </p>
      </div>
    </section>
  );
}
