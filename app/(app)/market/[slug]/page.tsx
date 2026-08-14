import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/features/marketplace/components/favorite-button";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { formatPrice, PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";
import { getPublicProduct } from "@/features/marketplace/services/product.service";

export const metadata = { title: "Product" };

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const product = await getPublicProduct(slug, session?.user.id);

  if (!product) {
    notFound();
  }

  const sold = !product.inStock;
  const actionLabel = sold
    ? "Sold"
    : product.listingType === "AUCTION"
      ? "Place bid · Phase 7"
      : "Buy · Phase 8";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface-2">
        <span className="font-mono text-sm tracking-widest text-muted uppercase">
          {product.game.name}
        </span>
      </div>
      <div className="space-y-4">
        <RarityChip rarity={product.rarity} />
        <h1 className="text-3xl font-semibold tracking-tight">{product.title}</h1>
        <p className="text-sm text-muted">
          {product.game.name} · {product.category.name} · {product.seller.displayName}
          {product.seller.kobaId ? (
            <span className="ml-2 font-mono text-xs">{product.seller.kobaId}</span>
          ) : null}
        </p>
        <p className="text-sm leading-relaxed">{product.description}</p>
        <p className="text-xs tracking-wide text-muted uppercase">
          {product.platforms.map((platform) => PLATFORM_LABEL[platform]).join(" · ")}
        </p>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted uppercase">
            {product.listingType === "AUCTION" ? "Starting bid" : "Price"}
          </p>
          <p className="mt-1 font-mono text-3xl">
            {formatPrice(product.priceCents, product.currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {sold ? "Out of stock" : `${product.inventoryQty} in inventory`}
          </p>
        </div>
        {product.variants.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {product.variants.map((variant) => (
              <li
                key={variant.sku}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  {variant.name} <span className="font-mono text-xs text-muted">{variant.sku}</span>
                </span>
                <span className="font-mono">
                  {formatPrice(variant.priceCents, product.currency)} · {variant.inventoryQty}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled>{actionLabel}</Button>
          <FavoriteButton
            slug={product.slug}
            initialFavorited={product.favorited}
            signedIn={Boolean(session?.user.id)}
          />
          <Link
            href="/market"
            className="inline-flex h-10 items-center px-3 text-sm text-neon-lime hover:underline"
          >
            Back to market
          </Link>
        </div>
      </div>
    </div>
  );
}
