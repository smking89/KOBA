import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubmitProductButton } from "@/features/shops/components/submit-product-button";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { listSellerProducts } from "@/features/shops/services/product-admin.service";
import { getOwnedShop } from "@/features/shops/services/shop.service";

export const metadata = { title: "Shop products" };

export default async function BusinessProductsPage() {
  const { userId } = await requireBusinessDashboard("/business/products");
  const shop = await getOwnedShop(userId);

  if (!shop) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted">Open a shop before managing listings.</p>
        <Link href="/business" className={cn(buttonVariants())}>
          Open shop
        </Link>
      </div>
    );
  }

  const products = await listSellerProducts(userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted">
            New listings start as drafts. Submit for KOBA staff review — sellers cannot
            self-approve.
          </p>
        </div>
        <Link href="/business/products/new" className={cn(buttonVariants())}>
          New listing
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted">No listings yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {products.map((product) => (
            <li
              key={product.slug}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-medium">{product.title}</p>
                <p className="text-xs text-muted">
                  {product.game.name} · {product.category.name}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    product.moderationStatus === "APPROVED"
                      ? "success"
                      : product.moderationStatus === "PENDING"
                        ? "warning"
                        : "default"
                  }
                >
                  {product.moderationStatus}
                </Badge>
                <Link
                  href={`/business/products/${product.slug}/edit`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Edit
                </Link>
                <SubmitProductButton slug={product.slug} status={product.moderationStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
