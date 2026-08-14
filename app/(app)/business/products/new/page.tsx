import { ProductForm } from "@/features/shops/components/product-form";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { listCategories, listGames } from "@/features/marketplace/services/product.service";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "New listing" };

export default async function NewProductPage() {
  const { userId } = await requireBusinessDashboard("/business/products/new");
  const shop = await getOwnedShop(userId);

  if (!shop) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">New listing</h1>
        <p className="text-sm text-muted">Open a shop first.</p>
        <Link href="/business" className={cn(buttonVariants())}>
          Open shop
        </Link>
      </div>
    );
  }

  const [games, categories] = await Promise.all([listGames(), listCategories()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New listing</h1>
        <p className="mt-1 text-sm text-muted">
          Saved as a draft. It will not appear on the market until staff approve it.
        </p>
      </div>
      <ProductForm games={games} categories={categories} mode="create" />
    </div>
  );
}
