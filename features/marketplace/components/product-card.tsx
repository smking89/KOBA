import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductActionRail } from "@/features/marketplace/components/product-action-rail";
import { PlatformIcon } from "@/features/marketplace/components/platform-icon";
import { StarRating } from "@/features/marketplace/components/star-rating";
import { RarityChip, rarityAccentClass } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

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
  const sellerName = `${product.seller.displayName}${product.seller.verified ? " · Verified" : ""}`;

  return (
    <article
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface-3 shadow-soft border-t-[3px] transition-[border-color,box-shadow] duration-150 hover:border-white/12",
        rarityAccentClass(product.rarity),
      )}
    >
      <div className="relative h-40 shrink-0 bg-black/25">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-xs tracking-widest text-muted uppercase">
          {product.game.name}
        </span>
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
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
        <div className="absolute top-2 right-2 z-10">
          <ProductActionRail product={product} signedIn={signedIn} variant="card" />
        </div>
        {product.platforms.length > 0 ? (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2 py-1 backdrop-blur-sm">
            {product.platforms.map((platform) => (
              <PlatformIcon
                key={platform}
                platform={platform}
                className="h-3.5 w-3.5 text-foreground"
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <RarityChip rarity={product.rarity} size="sm" />
          <StarRating ratingAvg={product.shopRatingAvg} reviewCount={product.shopReviewCount} />
        </div>
        <Link
          href={`/market/${product.slug}`}
          className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-semibold hover:text-neon-lime"
        >
          {product.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {product.game.name}
          {" · "}
          {product.seller.shopSlug ? (
            <Link href={`/shops/${product.seller.shopSlug}`} className="hover:text-neon-lime">
              {sellerName}
            </Link>
          ) : (
            sellerName
          )}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <span
              className={cn(
                "block font-mono text-lg leading-none",
                sold && "text-muted line-through",
              )}
            >
              {formatPrice(displayCents, product.currency)}
            </span>
            {product.auction && product.listingType === "AUCTION" ? (
              <p className="mt-1 font-mono text-[0.65rem] text-neon-lime">
                <AuctionCountdown endsAt={product.auction.endsAt} />
              </p>
            ) : null}
          </div>
          {sold ? (
            <Button variant="secondary" size="sm" disabled>
              {actionLabel}
            </Button>
          ) : (
            <Link href={`/market/${product.slug}`} className="shrink-0">
              <Button size="sm">{actionLabel}</Button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
