import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { listBuyerPurchases } from "@/features/developers/services/purchase.service";

export const metadata = { title: "App orders" };

export default async function AppOrdersPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/orders/apps");
  const items = await listBuyerPurchases(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">App purchases</h1>
        <p className="mt-2 text-sm text-muted">
          Price snapshots are immutable. Seller cash-out remains pending in earned KOBA Coins.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.publicRef}>
            <Card>
              <CardTitle>{item.productName}</CardTitle>
              <CardDescription>
                {item.status} · {item.priceCoins} coins · {item.publicRef}
              </CardDescription>
              <Link
                href={`/apps/${item.productSlug}`}
                className="mt-2 inline-flex text-sm text-neon-lime"
              >
                Product
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
