import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/features/marketplace/components/favorite-button";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import { formatPrice, PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

const frameBorderClass: Record<ProductRarity, string> = {
  COMMON: "border-rarity-common/60",
  UNCOMMON: "border-rarity-uncommon/60",
  RARE: "border-rarity-rare/60",
  EPIC: "border-rarity-epic/60",
  LEGENDARY: "border-rarity-legendary/60",
  RELIC: "border-rarity-relic/70 shadow-[0_0_18px_-6px_var(--color-rarity-relic)]",
};

const artBoxClass: Record<ProductRarity, string> = {
  COMMON: "from-rarity-common/25 via-surface-2 to-surface-2",
  UNCOMMON: "from-rarity-uncommon/25 via-surface-2 to-surface-2",
  RARE: "from-rarity-rare/25 via-surface-2 to-surface-2",
  EPIC: "from-rarity-epic/25 via-surface-2 to-surface-2",
  LEGENDARY: "from-rarity-legendary/25 via-surface-2 to-surface-2",
  RELIC: "from-rarity-relic/30 via-surface-2 to-surface-2",
};

/**
 * TCG-card-styled product listing (client framing, 2026-08-16): header
 * name/rarity row, an "art box," a type/platform badge row, a stat plate
 * (stock + listing type), italic flavor text, and a footer with a
 * SKU-style identifier plus the price/action bar.
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
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 bg-surface p-2 shadow-soft",
        frameBorderClass[product.rarity],
      )}
    >
      {/* Header: name + rarity "cost gem" */}
      <div className="flex items-start justify-between gap-2 px-1 pt-1 pb-2">
        <Link
          href={`/market/${product.slug}`}
          className="line-clamp-2 text-sm leading-tight font-bold hover:text-neon-lime"
        >
          {product.title}
        </Link>
        <RarityChip rarity={product.rarity} className="shrink-0" />
      </div>

      {/* Art box */}
      <div
        className={cn(
          "relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br",
          artBoxClass[product.rarity],
        )}
      >
        <span className="font-mono text-xs font-semibold tracking-widest text-foreground/70 uppercase">
          {product.game.name}
        </span>
        {product.boosted ? (
          <span className="absolute top-2 left-2 rounded-full bg-neon-lime/15 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-neon-lime uppercase">
            Boosted
          </span>
        ) : null}
        {product.freebiePolicy !== "NONE" ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-neon-mint/15 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-neon-mint uppercase">
            Free
          </span>
        ) : null}
        <div className="absolute top-2 right-2">
          <FavoriteButton
            slug={product.slug}
            initialFavorited={product.favorited}
            signedIn={signedIn}
          />
        </div>
      </div>

      {/* Type / platform badge row */}
      <div className="flex flex-wrap items-center gap-1 px-1 pt-2 text-[0.6rem] tracking-wide text-muted uppercase">
        <span className="rounded border border-border px-1.5 py-0.5">{product.category.name}</span>
        {product.platforms.map((platform) => (
          <span key={platform} className="rounded border border-border px-1.5 py-0.5">
            {PLATFORM_LABEL[platform]}
          </span>
        ))}
      </div>

      {/* Stat plate */}
      <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-center font-mono text-[0.65rem]">
        <div className="bg-surface-2 px-2 py-1.5">
          <dt className="text-muted uppercase">Stock</dt>
          <dd className={cn("font-semibold", sold && "text-destructive")}>
            {sold ? "0" : "In stock"}
          </dd>
        </div>
        <div className="bg-surface-2 px-2 py-1.5">
          <dt className="text-muted uppercase">Listing</dt>
          <dd className="font-semibold">
            {product.listingType === "AUCTION" ? "Auction" : "Fixed"}
          </dd>
        </div>
      </dl>

      {/* Flavor text */}
      {product.descriptionSnippet ? (
        <p className="mt-2 px-1 text-xs leading-snug text-muted italic">
          &ldquo;{product.descriptionSnippet}&rdquo;
        </p>
      ) : null}

      {/* Footer: SKU-style identity + price/action bar */}
      <div className="mt-auto space-y-2 px-1 pt-3">
        <p className="flex items-center justify-between font-mono text-[0.6rem] text-muted">
          <span>
            {product.seller.shopSlug ? (
              <Link href={`/shops/${product.seller.shopSlug}`} className="hover:text-neon-lime">
                {product.seller.kobaId ?? product.seller.displayName}
              </Link>
            ) : (
              (product.seller.kobaId ?? product.seller.displayName)
            )}
            {product.seller.verified ? " · Verified" : ""}
          </span>
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
    </article>
  );
}
