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

// Pointed-end "hex banner" ribbon, used for the name plate and the
// seller plate — client reference layout, 2026-08-16.
const HEX_CLIP = "polygon(3% 0%, 97% 0%, 100% 50%, 97% 100%, 3% 100%, 0% 50%)";

/**
 * TCG-card-styled product listing (client reference layout, 2026-08-16):
 * a fire-gradient frame, a hex name banner, a large art box with a
 * right-edge action rail (save / share / boost — the three real,
 * data-backed actions this app has; no fake like/comment/repost counts),
 * a platform-icon row and a real star rating (from the seller's Shop
 * reviews) inside the art box, a hex seller banner, and a footer with
 * the price/action bar.
 */
export function ProductCard({
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
    <article className="rounded-2xl bg-brand-gradient p-[3px] shadow-soft">
      <div className="flex flex-col overflow-hidden rounded-[calc(1rem-1px)] bg-background">
        {/* Name banner */}
        <div className="bg-background px-6 py-2 text-center" style={{ clipPath: HEX_CLIP }}>
          <Link
            href={`/market/${product.slug}`}
            className="line-clamp-1 text-lg font-extrabold tracking-tight hover:text-neon-lime"
          >
            {product.title}
          </Link>
        </div>

        {/* Art box */}
        <div className="relative mx-2 aspect-square overflow-hidden rounded-lg bg-white">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs font-semibold tracking-widest text-black/25 uppercase">
              {product.game.name}
            </span>
          </div>

          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.boosted ? (
              <span className="rounded-full bg-neon-lime px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-background uppercase">
                Boosted
              </span>
            ) : null}
            {product.freebiePolicy !== "NONE" ? (
              <span className="rounded-full bg-neon-mint px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-background uppercase">
                Free
              </span>
            ) : null}
          </div>

          {/* Action rail */}
          <div className="absolute top-2 right-2 flex flex-col items-center gap-2 rounded-full bg-white/80 p-1 backdrop-blur-sm">
            <FavoriteButton
              slug={product.slug}
              initialFavorited={product.favorited}
              signedIn={signedIn}
            />
            <ShareButton slug={product.slug} title={product.title} />
            <Link
              href="/wallet"
              aria-label="Boost this listing"
              title="Boost"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neon-lime transition-transform hover:scale-110"
            >
              <Zap className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {/* Platform row */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 backdrop-blur-sm">
            {product.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="h-3.5 w-3.5 text-black/70" />
            ))}
          </div>

          {/* Star rating (real Shop review average) */}
          <div className="absolute right-2 bottom-2 rounded-full bg-white/80 px-2 py-1 backdrop-blur-sm">
            <StarRating ratingAvg={product.shopRatingAvg} reviewCount={product.shopReviewCount} />
          </div>
        </div>

        {/* Seller banner */}
        <div
          className="mt-2 flex items-center justify-center gap-1.5 bg-background px-6 py-1.5 text-sm font-semibold"
          style={{ clipPath: HEX_CLIP }}
        >
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

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 px-4 py-3">
          <RarityChip rarity={product.rarity} />
          {product.descriptionSnippet ? (
            <p className="text-xs leading-snug text-muted italic">
              &ldquo;{product.descriptionSnippet}&rdquo;
            </p>
          ) : null}
          <p className="mt-auto flex items-center justify-between font-mono text-[0.6rem] text-muted">
            <span>{product.game.name}</span>
            <span>{product.slug}</span>
          </p>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <div>
              <span className={cn("font-mono text-lg", sold && "text-muted line-through")}>
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
        </div>
      </div>
    </article>
  );
}
