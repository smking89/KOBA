import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicPromo } from "@/features/influencer/services/influencer.service";

export const metadata = { title: "Creator promo" };

export default async function PublicPromoPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const promo = await getPublicPromo(handle);
  if (!promo) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Influencer promo</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">@{promo.handle}</h1>
        {promo.displayName ? <p className="mt-1 text-sm text-muted">{promo.displayName}</p> : null}
      </div>
      {promo.codes.length === 0 ? (
        <p className="text-sm text-muted">No public referral listings yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {promo.codes.map((row) => (
            <li key={row.code}>
              <Card>
                <CardTitle>{row.productTitle}</CardTitle>
                <CardDescription className="font-mono">{row.code}</CardDescription>
                <Link href={row.sharePath} className="mt-3 inline-block text-sm text-neon-mint">
                  Open with referral
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
