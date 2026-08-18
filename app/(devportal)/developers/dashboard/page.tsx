import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import { listMyProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "Developer dashboard" };

export default async function DeveloperDashboardPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/developers/dashboard");
  const profile = await getMyDeveloperProfile(session.user.id);
  if (!profile) redirect("/developers/new");
  const products = await listMyProducts(session.user.id).catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
        <p className="mt-2 text-sm text-muted">
          Role {profile.role}
          {profile.verified ? " · Verified publisher" : " · Unverified — staff review required"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Products</CardTitle>
          <CardDescription>{products.length} listed</CardDescription>
          <Link
            href="/developers/products"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Manage
          </Link>
        </Card>
        <Card>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Hashed at rest. Revealed once.</CardDescription>
          <Link
            href="/developers/api-keys"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Keys
          </Link>
        </Card>
        <Card>
          <CardTitle>Public page</CardTitle>
          <CardDescription>/{profile.slug}</CardDescription>
          <Link
            href={`/developers/${profile.slug}`}
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            View
          </Link>
        </Card>
      </div>
    </div>
  );
}
