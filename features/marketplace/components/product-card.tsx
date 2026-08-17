import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductActionRail } from "@/features/marketplace/components/product-action-rail";
import { PlatformIcon } from "@/features/marketplace/components/platform-icon";
import { StarRating } from "@/features/marketplace/components/star-rating";
import { RarityChip, rarityAccentClass } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice, type ProductRarity } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

// Rarity-tinted radial backdrop for listings with no seller-uploaded media
// yet (ProductMedia exists in the schema but there's no upload UI wired
// into the seller product form — see ROADMAP). Same tokens as
// market-feed-slide's placeholder, so a listing looks consistent whether
// it's viewed as a grid card or a feed slide.
const backdropClass: Record<ProductRarity, string> = {
  COMMON: "from-rarity-common/30",
  UNCOMMON: "from-rarity-uncommon/30",
  RARE: "from-rarity-rare/30",
  EPIC: "from-rarity-epic/30",
  LEGENDARY: "from-rarity-legendary/30",
  RELIC: "from-rarity-relic/35",
};

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
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface-3 shadow-soft border-t-[3px] transition-[border-color,box-shadow] duration-150 hover:border-white/12",
        rarityAccentClass(product.rarity),
      )}
    >
      {/* Vertical media stage — 4:5 portrait, matches how the swipeable
          feed and TikTok-reference cards present product photo/video. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/30">
        <Link href={`/market/${product.slug}`} className="absolute inset-0 block">
          {product.thumbnailUrl ? (
            product.thumbnailKind === "VIDEO" ? (
              <video
                src={product.thumbnailUrl}
                muted
                loop
                playsInline
                autoPlay
                className="h-full w-full object-cover"
              />
            ) : (
              // Remote seller-uploaded media — arbitrary origin, same
              // plain-<img> pattern as ProfileHero's avatar.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnailUrl}
                alt={product.thumbnailAlt}
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-gradient-to-br to-background",
                backdropClass[product.rarity],
              )}
            >
              <span className="px-6 text-center font-mono text-xs tracking-widest text-foreground/25 uppercase">
                {product.game.name}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        </Link>

        <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1">
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <RarityChip rarity={product.rarity} size="lg" />
        <Link
          href={`/market/${product.slug}`}
          className="text-base font-semibold hover:text-neon-lime"
        >
          {product.title}
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="flex items-center gap-1">
            {product.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="h-3.5 w-3.5" />
            ))}
          </div>
          {product.shopReviewCount > 0 ? (
            <>
              <span aria-hidden>·</span>
              <StarRating ratingAvg={product.shopRatingAvg} reviewCount={product.shopReviewCount} />
              <span>({product.shopReviewCount})</span>
            </>
          ) : null}
        </div>

        {/* Flat inline row — no circle backdrop (client correction,
            2026-08-16) — five real actions: like, comment, save, repost, share. */}
        <ProductActionRail product={product} signedIn={signedIn} layout="inline" />

        {product.descriptionSnippet ? (
          <p className="text-xs leading-snug text-muted italic">
            &ldquo;{product.descriptionSnippet}&rdquo;
          </p>
        ) : null}
        <p className="text-xs text-muted">
          {product.game.name} ·{" "}
          {product.seller.shopSlug ? (
            <Link href={`/shops/${product.seller.shopSlug}`} className="hover:text-neon-lime">
              {product.seller.displayName}
              {product.seller.verified ? " · Verified" : ""}
            </Link>
          ) : (
            product.seller.displayName
          )}
          {product.seller.kobaId ? (
            <span className="mt-0.5 block font-mono">{product.seller.kobaId}</span>
          ) : null}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
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
    </article>
  );
}
