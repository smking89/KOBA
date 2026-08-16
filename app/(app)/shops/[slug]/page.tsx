import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { FollowShopButton } from "@/features/shops/components/follow-shop-button";
import { ShopReviewForm } from "@/features/shops/components/shop-review-form";
import { listPublicProductsForShop } from "@/features/marketplace/services/product.service";
import { getPublicShop } from "@/features/shops/services/shop.service";
import { PlusBadge } from "@/features/plus/components/plus-badge";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  return { title: shop?.name ?? "Shop" };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const shop = await getPublicShop(slug, session?.user.id);

  if (!shop) {
    notFound();
  }

  const catalog = await listPublicProductsForShop(slug, session?.user.id);
  const verified = shop.verificationStatus === "VERIFIED";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
            {verified ? <Badge tone="live">Verified</Badge> : <Badge>Unverified</Badge>}
            <PlusBadge visible={shop.plusBadge} />
          </div>
          {shop.kobaId ? <p className="mt-2 font-mono text-sm text-muted">{shop.kobaId}</p> : null}
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{shop.bio}</p>
          <p className="mt-3 text-xs text-muted">
            {shop.followerCount} followers · {shop.reviewCount} reviews
            {shop.ratingAvg ? ` · ${shop.ratingAvg.toFixed(1)} avg` : ""}
          </p>
        </div>
        <FollowShopButton
          slug={shop.slug}
          initialFollowing={shop.following}
          signedIn={Boolean(session?.user.id)}
          isOwner={shop.isOwner}
        />
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Products</h2>
        {catalog.items.length === 0 ? (
          <p className="text-sm text-muted">No approved listings yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.items.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                signedIn={Boolean(session?.user.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>About</CardTitle>
          <CardDescription>{shop.bio}</CardDescription>
          <ul className="mt-4 space-y-2 text-sm">
            {shop.members.map((member) => (
              <li
                key={`${member.role}-${member.name}`}
                className="flex items-center justify-between"
              >
                <span>{member.name}</span>
                <Badge>{member.role === "OWNER" ? "Shop owner" : "Shop moderator"}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Shop owner and moderator are community roles, not KOBA staff.
          </p>
        </Card>
        <Card>
          <CardTitle>Reviews</CardTitle>
          <div className="mt-4 space-y-4">
            <ShopReviewForm
              slug={shop.slug}
              signedIn={Boolean(session?.user.id)}
              isOwner={shop.isOwner}
            />
            {shop.reviews.length === 0 ? (
              <p className="text-sm text-muted">No reviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {shop.reviews.map((review) => (
                  <li key={review.id} className="border-t border-border pt-3">
                    <p className="text-sm font-medium">
                      {review.author} · {review.rating}/5
                    </p>
                    <p className="mt-1 text-sm text-muted">{review.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <Link href="/market" className="text-sm text-neon-lime hover:underline">
        Back to market
      </Link>
    </div>
  );
}
