import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { listBuyerEntitlements } from "@/features/developers/services/purchase.service";

export const metadata = { title: "App library" };

export default async function AppLibraryPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/library/apps");
  const items = await listBuyerEntitlements(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Owned apps</h1>
        <p className="mt-2 text-sm text-muted">
          Permanent entitlements from free claims and KOBA Coin purchases.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.productRef}>
            <Card>
              <CardTitle>{item.productName}</CardTitle>
              <CardDescription>
                {item.source}
                {item.suspended ? " · Suspended — downloads may be blocked" : ""}
              </CardDescription>
              <Link
                href={`/apps/${item.productSlug}`}
                className="mt-3 inline-flex text-sm text-neon-lime"
              >
                Open
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
