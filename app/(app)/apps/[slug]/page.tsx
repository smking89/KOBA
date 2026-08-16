import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PurchaseButton } from "@/features/developers/components/developer-forms";
import { getPublicProduct } from "@/features/developers/services/developer.service";
import { prisma } from "@/lib/db";

export const metadata = { title: "App" };

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublicProduct(slug).catch(() => null);
  if (!product) notFound();
  const session = await auth();
  const owned = session?.user.id
    ? Boolean(
        await prisma.devEntitlement.findFirst({
          where: { userId: session.user.id, productId: product.id, revokedAt: null },
        }),
      )
    : false;
  const priceLabel =
    product.pricing === "FREE" || product.priceCoins <= 0n
      ? "Free"
      : `${product.priceCoins.toString()} KOBA Coins`;
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
    <div className="space-y-8">
      <div>
        {product.kobaOfficial ? (
          <Badge tone="success">KOBA official</Badge>
        ) : product.profile?.verified ? (
          <Badge>Verified publisher</Badge>
        ) : (
          <Badge tone="warning">Unverified third-party</Badge>
        )}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {product.shortDescription || product.description}
        </p>
        <p className="mt-3 text-xs text-muted">
          Third-party software is not guaranteed safe. KOBA never executes uploaded plugin code on
          the web server or VPS workers.
        </p>
      </div>
      <Card>
        <CardTitle>{priceLabel}</CardTitle>
        <CardDescription>
          Price is read from the server at purchase time. KOBA Coins only — no fiat conversion.
        </CardDescription>
        <div className="mt-4">
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
              className="text-sm text-neon-lime"
            >
              Sign in to purchase
            </Link>
          )}
        </div>
      </Card>
      {screenshots.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {screenshots.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="rounded-md border border-border" />
          ))}
        </div>
      ) : null}
      <Card>
        <CardTitle>Versions</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {product.versions.map((version) => (
            <li key={version.publicRef}>
              v{version.semver} · {version.channel} · {version.reviewState}
              {owned &&
              (version.reviewState === "APPROVED" || version.reviewState === "PUBLISHED") ? (
                <Link
                  href={`/api/apps/versions/${version.publicRef}/download`}
                  className="ml-2 text-neon-lime"
                >
                  Download
                </Link>
              ) : null}
              <p className="text-xs text-muted">{version.changelog || "No changelog."}</p>
              <p className="text-xs text-muted">Requires: {version.requirements || "—"}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Links</CardTitle>
        <ul className="mt-3 space-y-1 text-sm">
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
                Privacy
              </a>
            </li>
          ) : null}
          {product.profile ? (
            <li>
              <Link className="text-neon-lime" href={`/developers/${product.profile.slug}`}>
                Publisher
              </Link>
            </li>
          ) : null}
        </ul>
      </Card>
      <Card>
        <CardTitle>Reviews</CardTitle>
        <ul className="mt-3 space-y-3 text-sm">
          {product.reviews.map((review) => (
            <li key={review.id}>
              {review.rating}/5 · {review.body || "No comment."}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
