import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { MOCK_DEV_PRODUCTS, devReviewLabel } from "@/features/developer-portal/lib/types";

export const metadata = { title: "Developer apps" };

export default function DeveloperAppsPage() {
  const apps = MOCK_DEV_PRODUCTS.filter((product) => product.kind === "APPLICATION");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/developers" className="text-sm text-muted hover:text-foreground">
          ← Developers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Applications</h1>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <li key={app.publicRef}>
            <Card>
              <CardTitle>{app.name}</CardTitle>
              <CardDescription>
                {app.pricing} · {app.priceLabel} · v{app.version}
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="accent">{devReviewLabel(app.reviewState)}</StatusPill>
                <StatusPill>{app.installs} installs</StatusPill>
              </div>
              <p className="mt-3 text-xs text-muted">
                Compat: {app.compatibility.join(", ")} · Scopes: {app.scopes.join(", ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm">Install</Button>
                <Button size="sm" variant="ghost">
                  Revoke
                </Button>
                <Button size="sm" variant="secondary">
                  Submit for review
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
