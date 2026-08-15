import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreateShopForm } from "@/features/shops/components/create-shop-form";
import { RequestVerificationButton } from "@/features/shops/components/request-verification-button";
import { ShopPromoForm } from "@/features/shops/components/shop-promo-form";
import { ShopRarityDistributionCard } from "@/features/shops/components/shop-rarity-distribution-card";
import { TaggingToggle } from "@/features/social/components/tagging-toggle";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { getShopAnalytics } from "@/features/shops/services/shop.service";
import { getPromoConfig } from "@/features/shops/services/promo.service";

export const metadata = { title: "Business dashboard" };

export default async function BusinessDashboardPage() {
  const { userId, snapshot } = await requireBusinessDashboard("/business");
  const data = await getShopAnalytics(userId);

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Open your shop</h1>
          <p className="mt-2 text-sm text-muted">
            A Business KOBAID can own one shop. Listings stay draft until KOBA staff approve them.
          </p>
        </div>
        <CreateShopForm />
      </div>
    );
  }

  const shop = data.shop;
  const verified = shop.verificationStatus === "VERIFIED";
  const promoConfig = await getPromoConfig(userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
            {verified ? (
              <Badge tone="live">Verified</Badge>
            ) : (
              <Badge>{shop.verificationStatus}</Badge>
            )}
          </div>
          <p className="mt-2 font-mono text-sm text-muted">{snapshot.kobaId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/shops/${shop.slug}`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            View shop
          </Link>
          <Link href="/business/products" className={cn(buttonVariants())}>
            Manage products
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Live listings</CardTitle>
          <p className="mt-2 font-mono text-2xl">{data.listings.approved}</p>
          <CardDescription>
            {data.listings.pending} pending · {data.listings.draft} drafts
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Followers</CardTitle>
          <p className="mt-2 font-mono text-2xl">{data.followers}</p>
          <CardDescription>{data.reviews} shop reviews</CardDescription>
        </Card>
        <Card>
          <CardTitle>Orders</CardTitle>
          <p className="mt-2 font-mono text-2xl">{shop._count.orders}</p>
          <CardDescription>
            {data.orders.PAID + data.orders.FULFILLED} paid · {data.orders.PENDING} pending
          </CardDescription>
        </Card>
      </div>

      <Card>
        <CardTitle>Shop tagging</CardTitle>
        <CardDescription className="mb-3">
          When off, posts cannot tag this shop. Sponsored placements remain a later ads phase.
        </CardDescription>
        <TaggingToggle
          endpoint="/api/business/tagging"
          initial={shop.taggingAllowed}
          label="Allow shop tags"
        />
      </Card>

      <Card>
        <CardTitle>Inventory</CardTitle>
        <p className="mt-2 font-mono text-2xl">{data.inventoryQty}</p>
        <CardDescription>Units across all shop listings, including drafts.</CardDescription>
      </Card>

      <ShopRarityDistributionCard distribution={data.rarityDistribution} />

      <ShopPromoForm promoConfig={promoConfig} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/business/orders" className={cn(buttonVariants({ variant: "secondary" }))}>
          Order inbox
        </Link>
        <Link href="/business/payouts" className={cn(buttonVariants({ variant: "secondary" }))}>
          Payouts
        </Link>
        <RequestVerificationButton status={shop.verificationStatus} />
        <Link href="/settings" className={cn(buttonVariants({ variant: "ghost" }))}>
          Switch account mode
        </Link>
      </div>
    </div>
  );
}
