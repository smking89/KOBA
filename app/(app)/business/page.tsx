import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreateShopForm } from "@/features/shops/components/create-shop-form";
import { RequestVerificationButton } from "@/features/shops/components/request-verification-button";
import { ShopRarityDistributionCard } from "@/features/shops/components/shop-rarity-distribution-card";
import { TaggingToggle } from "@/features/social/components/tagging-toggle";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { getShopAnalytics } from "@/features/shops/services/shop.service";
import { ShopPromoForm } from "@/features/influencer/components/shop-promo-form";
import { getShopPromo } from "@/features/influencer/services/influencer.service";
import { SocialConnectionsPanel } from "@/features/social-connections/components/social-connections-panel";
import { socialProviderConfiguredMap } from "@/features/social-connections/lib/providers";
import { listShopSocialConnections } from "@/features/social-connections/services/social-connection.service";
import { ShopBlacklistPanel } from "@/features/blacklist/components/shop-blacklist-panel";
import { listShopBlacklist } from "@/features/blacklist/services/shop-blacklist.service";
import { KobaShopApplicationCard } from "@/features/koba-shop/components/koba-shop-application-card";
import { getShopApplication } from "@/features/koba-shop/services/application.service";
import { ShopBannerPanel } from "@/features/koba-shop/components/shop-banner-panel";
import { listOwnedCosmetics } from "@/features/koba-shop/services/cosmetic-checkout.service";

export const metadata = { title: "Business dashboard" };

export default async function BusinessDashboardPage() {
  const { userId, snapshot } = await requireBusinessDashboard("/business");
  const data = await getShopAnalytics(userId);
  const promo = data ? await getShopPromo(userId).catch(() => null) : null;

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
  const shopSocialConnections = await listShopSocialConnections(shop.id);
  const shopBlacklist = await listShopBlacklist(shop.id, userId);
  const kobaShopApplication = await getShopApplication(shop.id);
  const ownedCosmetics = await listOwnedCosmetics(userId);

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
        <CardTitle>Influencer promos</CardTitle>
        <CardDescription className="mb-3">
          Opt in to let Influencer KOBAIDs create HANDLE-PRODUCT referral codes. Payout terms come
          from this shop, not the influencer.
        </CardDescription>
        {promo ? <ShopPromoForm initial={promo} /> : null}
      </Card>

      <Card>
        <CardTitle>Shop socials</CardTitle>
        <CardDescription className="mb-4">
          Connected accounts show as verified badges on your shop&apos;s storefront bio.
        </CardDescription>
        <SocialConnectionsPanel
          configured={socialProviderConfiguredMap()}
          connections={shopSocialConnections}
          shopId={shop.id}
        />
      </Card>

      <Card>
        <CardTitle>Blacklist</CardTitle>
        <CardDescription className="mb-4">
          Blocks purchases, freebie claims, follows, and reviews from that account across every
          server this shop owns — PC or console, current or future. KOBA doesn&apos;t yet
          auto-kick from Discord or auto-ban from a live server; that stays a manual step on your
          end for now.
        </CardDescription>
        <ShopBlacklistPanel
          initialEntries={shopBlacklist.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt.toISOString(),
          }))}
        />
      </Card>

      <Card>
        <CardTitle>KOBA Shop</CardTitle>
        <CardDescription className="mb-4">
          A second, narrower gate on top of your Blue-Badge verification — apply to sell cosmetics
          in KOBA&apos;s featured, homepage-linked storefront.
        </CardDescription>
        <KobaShopApplicationCard application={kobaShopApplication} />
      </Card>

      <Card>
        <CardTitle>Shop banner</CardTitle>
        <CardDescription className="mb-4">
          A KOBA Shop cosmetic that equips onto your storefront instead of your personal profile —
          needs your own active KOBA Plus subscription to equip.
        </CardDescription>
        <ShopBannerPanel
          initialBanners={ownedCosmetics
            .filter((item) => item.cosmetic.subType === "SHOP_BANNER")
            .map((item) => ({
              ownershipId: item.id,
              name: item.cosmetic.name,
              equipped: item.shopEquip !== null,
            }))}
        />
      </Card>

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

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/business/orders" className={cn(buttonVariants({ variant: "secondary" }))}>
          Order inbox
        </Link>
        <Link href="/business/payouts" className={cn(buttonVariants({ variant: "secondary" }))}>
          Payouts
        </Link>
        <Link href="/seller/promotions" className={cn(buttonVariants({ variant: "secondary" }))}>
          Promotions
        </Link>
        <RequestVerificationButton status={shop.verificationStatus} />
        <Link href="/settings" className={cn(buttonVariants({ variant: "ghost" }))}>
          Switch account mode
        </Link>
      </div>
    </div>
  );
}
