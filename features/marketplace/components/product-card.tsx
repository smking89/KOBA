import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ProductActionRail } from "@/features/marketplace/components/product-action-rail";
import { PlatformIcon } from "@/features/marketplace/components/platform-icon";
import { StarRating } from "@/features/marketplace/components/star-rating";
import { CardBanner } from "@/features/marketplace/components/card-banner";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice, type ProductRarity } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

// Rarity-tinted radial backdrop for listings with no seller-uploaded media
// yet (ProductMedia exists in the schema but there's no upload UI wired
// into the seller product form — see ROADMAP).
const backdropClass: Record<ProductRarity, string> = {
  COMMON: "from-rarity-common/25",
  UNCOMMON: "from-rarity-uncommon/25",
  RARE: "from-rarity-rare/25",
  EPIC: "from-rarity-epic/25",
  LEGENDARY: "from-rarity-legendary/25",
  RELIC: "from-rarity-relic/30",
};

// Outer card silhouette — chamfered corners on a gradient border (client
// reference, 2026-08-17, exact-match request: a TCG-card shape, not a
// plain rounded rectangle).
const CARD_CLIP =
  "polygon(6% 0%, 94% 0%, 100% 4%, 100% 96%, 94% 100%, 6% 100%, 0% 96%, 0% 4%)";

export function ProductCard({
  product,
  signedIn,
}: {
  product: PublicProductCard;
  signedIn: boolean;
}) {
  const sold = !product.inStock;
  const actionLabel = sold ? "Sold" : product.freebiePolicy !== "NONE" ? "Claim" : "Buy Now";
  const displayCents =
    product.listingType === "AUCTION"
      ? (product.auction?.highBidCents ?? product.priceCents)
      : product.priceCents;
  const isAuction = product.listingType === "AUCTION" && !sold;
  const sellerHandle = product.seller.handle ?? product.seller.displayName;

  return (
    <article className="relative w-full" style={{ clipPath: CARD_CLIP }}>
      {/* Gradient border — the frame itself is the brand fire gradient,
          not rarity-tinted, matching the reference exactly. */}
      <div className="bg-brand-gradient p-[3px]" style={{ clipPath: CARD_CLIP }}>
        <div className="flex h-full flex-col gap-2 bg-background pt-2 pb-3" style={{ clipPath: CARD_CLIP }}>
          {/* Title banner */}
          <CardBanner>
            <Link
              href={`/market/${product.slug}`}
              className="truncate text-lg font-extrabold text-white uppercase"
            >
              {product.title}
            </Link>
          </CardBanner>

          {/* Media stage */}
          <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-white px-2">
            <Link href={`/market/${product.slug}`} className="absolute inset-2 block overflow-hidden">
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
                    "flex h-full w-full items-center justify-center bg-gradient-to-br to-white",
                    backdropClass[product.rarity],
                  )}
                >
                  <span className="px-6 text-center font-mono text-xs tracking-widest text-black/30 uppercase">
                    {product.game.name}
                  </span>
                </div>
              )}
            </Link>

            {(product.boosted || product.freebiePolicy !== "NONE") ? (
              <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1">
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
            ) : null}

            {/* Action rail — orange outline, over the image's right edge */}
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              <ProductActionRail product={product} signedIn={signedIn} layout="card" />
            </div>

            {/* Platform icons — bottom-left of the image */}
            {product.platforms.length > 0 ? (
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                {product.platforms.map((platform) => (
                  <PlatformIcon
                    key={platform}
                    platform={platform}
                    className="h-5 w-5 text-neon-lime"
                  />
                ))}
              </div>
            ) : null}

            {/* Star rating — bottom-right of the image */}
            <div className="absolute right-3 bottom-3">
              <StarRating
                ratingAvg={product.shopRatingAvg}
                reviewCount={product.shopReviewCount}
                size="h-4 w-4"
                variant="card"
              />
            </div>
          </div>

          {/* Seller banner */}
          <CardBanner>
            {product.seller.shopSlug ? (
              <Link
                href={`/shops/${product.seller.shopSlug}`}
                className="flex items-center gap-1.5 truncate text-lg font-bold text-white"
              >
                {product.seller.verified ? (
                  <BadgeCheck className="h-5 w-5 shrink-0 fill-[#33c1f0] text-white" aria-hidden />
                ) : null}
                @{sellerHandle}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 truncate text-lg font-bold text-white">
                {product.seller.verified ? (
                  <BadgeCheck className="h-5 w-5 shrink-0 fill-[#33c1f0] text-white" aria-hidden />
                ) : null}
                @{sellerHandle}
              </span>
            )}
          </CardBanner>

          {/* Contents */}
          <div className="flex flex-1 flex-col gap-1.5 px-4 py-1">
            <h3 className="text-base font-bold text-white">
              {product.category.name}
              {product.seller.shopSlug ? ` · ${product.seller.displayName}` : ""}
            </h3>
            {product.descriptionSnippet ? (
              <p className="text-sm leading-relaxed text-white/80">
                {product.descriptionSnippet}
              </p>
            ) : null}
          </div>

          {/* Footer strip */}
          <div className="flex items-center justify-between gap-2 px-4 py-1">
            <Image
              src="/brand/koba-logo.png"
              alt="KOBA"
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain"
            />
            <p className="truncate text-center text-[0.65rem] text-white/50">
              © {new Date().getFullYear()} koba.games. All rights reserved.
            </p>
            {product.inventoryQty > 0 ? (
              <span className="shrink-0 font-mono text-[0.65rem] text-white/70">
                {product.inventoryQty} in stock
              </span>
            ) : null}
          </div>

          {isAuction && product.auction ? (
            <p className="px-4 pb-1 text-center font-mono text-[0.7rem] text-neon-lime">
              <AuctionCountdown endsAt={product.auction.endsAt} />
            </p>
          ) : null}

          {/* Price + action */}
          <div className="mt-1 flex items-center border-t border-white/10 px-4 pt-2">
            <span className={cn("font-mono text-lg font-bold text-white", sold && "text-white/40 line-through")}>
              {formatPrice(displayCents, product.currency)}
            </span>
          </div>

          {/* Buy / Bid split buttons */}
          <div className="mt-1 grid grid-cols-2 gap-2 px-4">
            {sold ? (
              <span className="col-span-2 flex h-9 items-center justify-center rounded-md border border-white/15 text-sm font-semibold text-white/40">
                Sold
              </span>
            ) : (
              <>
                <Link
                  href={`/market/${product.slug}`}
                  className="flex h-9 items-center justify-center rounded-md border border-neon-lime text-sm font-semibold text-neon-lime hover:bg-neon-lime/10"
                >
                  {actionLabel}
                </Link>
                <Link
                  href={`/market/${product.slug}`}
                  className="flex h-9 items-center justify-center rounded-md border border-neon-lime text-sm font-semibold text-neon-lime hover:bg-neon-lime/10"
                >
                  Bid
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
