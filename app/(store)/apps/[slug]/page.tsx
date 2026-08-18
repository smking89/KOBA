import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Download, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { PurchaseButton } from "@/features/developers/components/developer-forms";
import { StoreAppIcon } from "@/features/developers/components/store/store-app-icon";
import { StoreStarRating } from "@/features/developers/components/store/store-star-rating";
import { categoryLabel } from "@/features/developers/lib/categories";
import { getPublicProduct, searchPublicProducts } from "@/features/developers/services/developer.service";
import { prisma } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublicProduct(slug).catch(() => null);
  return { title: product ? product.name : "App not found" };
}

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublicProduct(slug).catch(() => null);
  if (!product) notFound();

  const session = await auth();
  const [owned, similar] = await Promise.all([
    session?.user.id
      ? prisma.devEntitlement
          .findFirst({ where: { userId: session.user.id, productId: product.id, revokedAt: null } })
          .then(Boolean)
      : Promise.resolve(false),
    searchPublicProducts({ category: product.category, take: 5 }).catch(() => []),
  ]);
  const similarApps = similar.filter((app) => app.slug !== product.slug).slice(0, 4);

  const priceLabel =
    product.pricing === "FREE" || product.priceCoins <= 0n
      ? "Free"
      : `${product.priceCoins.toString()} KOBA Coins`;
  const rating =
    product.ratingCount > 0 ? Number((product.ratingSum / product.ratingCount).toFixed(2)) : null;
  const screenshots = (() => {
    try {
      const parsed = JSON.parse(product.screenshotsJson) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-10">
      <Link href="/apps" className="text-sm text-muted hover:text-foreground">
        ← App Store
      </Link>

      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-start">
        <StoreAppIcon name={product.name} iconUrl={product.iconUrl} size={96} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            <p className="text-sm text-muted">
              {product.profile?.displayName ?? "Independent publisher"} ·{" "}
              {categoryLabel(product.category)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StoreStarRating rating={rating} ratingCount={product.ratingCount} />
            <span className="flex items-center gap-1 text-xs text-muted">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {product.downloadCount.toLocaleString()} installs
            </span>
            {product.kobaOfficial ? (
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                KOBA official
              </span>
            ) : product.profile?.verified ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                Verified publisher
              </span>
            ) : (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
                Unverified third-party
              </span>
            )}
          </div>
          <p className="max-w-2xl text-sm text-muted">
            {product.shortDescription || product.description}
          </p>
          <div className="flex items-center gap-4 pt-1">
            {session?.user.id ? (
              <PurchaseButton
                slug={product.slug}
                pricing={product.pricing}
                priceLabel={priceLabel}
                owned={owned}
              />
            ) : (
              <Link
                href={`/login?callbackUrl=/apps/${product.slug}`}
                className="rounded-full bg-neon-lime px-5 py-2 text-sm font-semibold text-background"
              >
                Sign in to {product.pricing === "FREE" ? "get" : "buy"}
              </Link>
            )}
            {!owned ? (
              <span className="text-sm font-semibold text-foreground">{priceLabel}</span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-xs text-muted">
        Third-party software is not guaranteed safe. KOBA never executes uploaded plugin code on
        the web server or VPS workers. Price is read from the server at purchase time — KOBA Coins
        only, no fiat conversion.
      </p>

      {screenshots.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-foreground">Screenshots</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {screenshots.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-48 w-auto shrink-0 rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-lg font-bold text-foreground">About this app</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-muted">
              {product.description || product.shortDescription || "No description yet."}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-lg font-bold text-foreground">Versions</h2>
            <ul className="mt-3 divide-y divide-border">
              {product.versions.map((version) => (
                <li key={version.publicRef} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-foreground">
                    v{version.semver}{" "}
                    <span className="font-normal text-muted">
                      · {version.channel} · {version.reviewState}
                    </span>
                    {owned &&
                    (version.reviewState === "APPROVED" ||
                      version.reviewState === "PUBLISHED") ? (
                      <Link
                        href={`/api/apps/versions/${version.publicRef}/download`}
                        className="ml-2 font-semibold text-neon-lime"
                      >
                        Download
                      </Link>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {version.changelog || "No changelog."}
                  </p>
                  <p className="text-xs text-muted">
                    Requires: {version.requirements || "—"}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Ratings and reviews</h2>
              <StoreStarRating rating={rating} ratingCount={product.ratingCount} />
            </div>
            <ul className="mt-3 divide-y divide-border">
              {product.reviews.length === 0 ? (
                <li className="py-3 text-sm text-muted">No reviews yet.</li>
              ) : (
                product.reviews.map((review) => (
                  <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                    <StoreStarRating rating={review.rating} ratingCount={0} showCount={false} />
                    <p className="mt-1 text-sm text-muted">
                      {review.body || "No comment."}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-bold text-foreground">Developer</h2>
            {product.profile ? (
              <Link
                href={`/developers/${product.profile.slug}`}
                className="mt-2 block text-sm font-semibold text-neon-lime"
              >
                {product.profile.displayName} →
              </Link>
            ) : (
              <p className="mt-2 text-sm text-muted">Independent publisher</p>
            )}
            <ul className="mt-3 space-y-1.5 text-sm">
              {product.docsUrl ? (
                <li>
                  <a className="text-neon-lime" href={product.docsUrl}>
                    Documentation
                  </a>
                </li>
              ) : null}
              {product.supportUrl ? (
                <li>
                  <a className="text-neon-lime" href={product.supportUrl}>
                    Support
                  </a>
                </li>
              ) : null}
              {product.privacyUrl ? (
                <li>
                  <a className="text-neon-lime" href={product.privacyUrl}>
                    Privacy policy
                  </a>
                </li>
              ) : null}
            </ul>
          </section>

          {similarApps.length > 0 ? (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <h2 className="text-sm font-bold text-foreground">Similar apps</h2>
              <ul className="mt-3 space-y-3">
                {similarApps.map((app) => (
                  <li key={app.publicRef}>
                    <Link href={`/apps/${app.slug}`} className="flex items-center gap-3">
                      <StoreAppIcon name={app.name} iconUrl={app.iconUrl} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {app.name}
                        </p>
                        <StoreStarRating
                          rating={app.rating}
                          ratingCount={app.ratingCount}
                          size={10}
                          showCount={false}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
