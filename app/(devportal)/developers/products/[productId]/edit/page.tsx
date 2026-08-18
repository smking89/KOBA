import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SubmitProductButton } from "@/features/developers/components/submit-product-button";
import { getOwnedProduct } from "@/features/developers/services/developer.service";
import { StatusPill } from "@/components/koba/status-pill";
import { devReviewLabel } from "@/features/developer-portal/lib/types";

export const metadata = { title: "Edit product" };

export default async function EditDeveloperProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const { productId } = await params;
  const product = await getOwnedProduct(session.user.id, productId).catch(() => null);
  if (!product) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
        <StatusPill>{devReviewLabel(product.reviewState)}</StatusPill>
        <p className="mt-2 text-sm text-muted">
          Price is stored as integer KOBA Coins. Staff must approve before publication.
        </p>
      </div>
      {(product.reviewState === "DRAFT" || product.reviewState === "CHANGES_REQUESTED") && (
        <SubmitProductButton publicRef={product.publicRef} />
      )}
      <Card>
        <CardTitle>Versions</CardTitle>
        <CardDescription>
          Artifacts stay private until an approved version is downloaded by an entitled buyer.
        </CardDescription>
        <ul className="mt-3 space-y-2 text-sm">
          {product.versions.map((version) => (
            <li key={version.publicRef} className="font-mono text-muted">
              {version.semver} · {version.channel} · {version.reviewState} ·{" "}
              {version.artifacts.map((artifact) => artifact.filename).join(", ") || "no artifact"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
