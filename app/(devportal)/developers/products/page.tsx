import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import { listMyProducts } from "@/features/developers/services/developer.service";
import { StatusPill } from "@/components/koba/status-pill";
import { devReviewLabel } from "@/features/developer-portal/lib/types";

export const metadata = { title: "Developer products" };

export default async function DeveloperProductsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/products");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const products = await listMyProducts(session.user.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-2 text-sm text-muted">Drafts stay private until staff publish them.</p>
        </div>
        <Link href="/developers/products/new" className={cn(buttonVariants({ size: "sm" }))}>
          New product
        </Link>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {products.map((product) => (
          <li key={product.publicRef}>
            <Card>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.priceLabel}</CardDescription>
              <div className="mt-3">
                <StatusPill>{devReviewLabel(product.reviewState)}</StatusPill>
              </div>
              <Link
                href={`/developers/products/${product.publicRef}/edit`}
                className="mt-3 inline-flex text-sm text-neon-lime"
              >
                Edit
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
