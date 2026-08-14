import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Business dashboard" };

export default async function BusinessDashboardPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/business");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (snapshot.activeAccountType !== "BUSINESS") {
    redirect("/enter");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {snapshot.displayName ?? "Business"}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted">{snapshot.kobaId}</p>
        </div>
        <Badge>Business mode</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Revenue · 30d</CardTitle>
          <p className="mt-2 font-mono text-2xl">—</p>
          <CardDescription>Shops and orders land in Phases 6–8.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Orders</CardTitle>
          <p className="mt-2 font-mono text-2xl">0</p>
          <CardDescription>No live catalog yet.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Followers</CardTitle>
          <p className="mt-2 font-mono text-2xl">0</p>
          <CardDescription>Shop follows land with business tools.</CardDescription>
        </Card>
      </div>

      <Link href="/settings" className={cn(buttonVariants({ variant: "secondary" }))}>
        Switch account mode
      </Link>
    </div>
  );
}
