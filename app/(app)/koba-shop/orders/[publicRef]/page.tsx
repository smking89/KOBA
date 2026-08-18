import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import { getCosmeticOrderReceipt } from "@/features/koba-shop/services/cosmetic-checkout.service";

export const metadata = { title: "KOBA Shop order" };
export const dynamic = "force-dynamic";

export default async function CosmeticOrderPage({
  params,
}: {
  params: Promise<{ publicRef: string }>;
}) {
  const { publicRef } = await params;
  const session = await auth();
  if (!session?.user.id) redirect(`/login?callbackUrl=/koba-shop/orders/${publicRef}`);

  const order = await getCosmeticOrderReceipt(publicRef, session.user.id);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{order.cosmetic.name}</CardTitle>
          <Badge tone={order.status === "PAID" ? "live" : "default"}>{order.status}</Badge>
        </div>
        <CardDescription className="mb-4">
          From {order.shop.name} · Order {order.publicRef}
        </CardDescription>
        <p className="font-mono text-lg">{formatPrice(order.unitPriceCents, order.currency)}</p>
        {order.status === "PAID" ? (
          <p className="mt-3 text-sm text-muted">
            It&apos;s in your inventory now. Equip it from{" "}
            <Link href="/settings" className="text-neon-lime hover:underline">
              Settings
            </Link>{" "}
            (requires an active KOBA Plus subscription).
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Still waiting on payment confirmation.</p>
        )}
      </Card>
    </div>
  );
}
