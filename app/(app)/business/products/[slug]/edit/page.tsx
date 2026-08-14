import { notFound } from "next/navigation";
import { ProductForm } from "@/features/shops/components/product-form";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { listCategories, listGames } from "@/features/marketplace/services/product.service";
import { getSellerProduct } from "@/features/shops/services/product-admin.service";
import { ShopError } from "@/features/shops/services/shop.service";
import type { GamePlatform, ListingType, ProductRarity } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "Edit listing" };

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await requireBusinessDashboard(`/business/products/${slug}/edit`);

  try {
    const [product, games, categories] = await Promise.all([
      getSellerProduct(userId, slug),
      listGames(),
      listCategories(),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit listing</h1>
          <p className="mt-1 text-sm text-muted">
            Editing a live listing sends it back to pending review.
          </p>
        </div>
        <ProductForm
          games={games}
          categories={categories}
          mode="edit"
          slug={product.slug}
          defaultValues={{
            title: product.title,
            description: product.description,
            rarity: product.rarity as ProductRarity,
            listingType: product.listingType as ListingType,
            priceCents: product.priceCents,
            inventoryQty: product.inventoryQty,
            gameSlug: product.game.slug,
            categorySlug: product.category.slug,
            platforms: product.platforms as GamePlatform[],
            durationHours: product.auction
              ? Math.max(
                  1,
                  Math.round((product.auction.endsAt.getTime() - Date.now()) / (60 * 60 * 1000)),
                )
              : 48,
            minIncrementCents: product.auction?.minIncrementCents ?? 1000,
          }}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof ShopError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
