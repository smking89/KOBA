import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/features/marketplace/components/favorite-button";
import { ShareButton } from "@/features/marketplace/components/share-button";
import { RarityChip, rarityAccentClass } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice, PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";
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

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface-3 shadow-soft border-t-[3px] transition-[border-color,box-shadow] duration-150 hover:border-white/12",
        rarityAccentClass(product.rarity),
      )}
    >
      <div className="relative flex h-36 items-center justify-center bg-black/25">
        <span className="font-mono text-xs tracking-widest text-muted uppercase">
          {product.game.name}
        </span>
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
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <ShareButton slug={product.slug} title={product.title} />
          <FavoriteButton
            slug={product.slug}
            initialFavorited={product.favorited}
            signedIn={signedIn}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <RarityChip rarity={product.rarity} />
        <Link
          href={`/market/${product.slug}`}
          className="text-base font-semibold hover:text-neon-lime"
        >
          {product.title}
        </Link>
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
        <p className="text-[0.65rem] tracking-wide text-muted uppercase">
          {product.platforms.map((platform) => PLATFORM_LABEL[platform]).join(" · ")}
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
