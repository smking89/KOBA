import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicDeveloperProfile } from "@/features/developers/services/portal.service";

export const metadata = { title: "Publisher" };

export default async function PublicDeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicDeveloperProfile(slug).catch(() => null);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <div>
        {profile.verified ? (
          <Badge tone="success">Verified publisher</Badge>
        ) : (
          <Badge>Unverified</Badge>
        )}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {profile.description || "No description."}
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {profile.products.map((product) => (
          <li key={product.slug}>
            <Card>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>
                {product.category} · {product.pricing}
                {product.kobaOfficial ? " · KOBA official" : ""}
              </CardDescription>
              <Link
                href={`/apps/${product.slug}`}
                className="mt-3 inline-flex text-sm text-neon-lime"
              >
                View product
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
