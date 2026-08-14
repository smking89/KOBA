import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { devReviewLabel } from "@/features/developer-portal/lib/types";
import { listProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "Developer apps" };

export default async function DeveloperAppsPage() {
  const session = await auth();
  const apps = (await listProducts("APPLICATION", session?.user.id).catch(() => [])).filter(
    (product) => product.kind === "APPLICATION",
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/developers" className="text-sm text-muted hover:text-foreground">
          ← Developers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Applications</h1>
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-muted">No applications yet.</p>
      ) : (
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
                  Compat: {app.compatibility.join(", ") || "—"} · Scopes:{" "}
                  {app.scopes.join(", ") || "—"}
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
      )}
    </div>
  );
}
