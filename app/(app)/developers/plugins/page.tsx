import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { MOCK_DEV_PRODUCTS, devReviewLabel } from "@/features/developer-portal/lib/types";

export const metadata = { title: "Developer plugins" };

export default function DeveloperPluginsPage() {
  const plugins = MOCK_DEV_PRODUCTS.filter((product) => product.kind === "PLUGIN");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/developers" className="text-sm text-muted hover:text-foreground">
          ← Developers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Plugins</h1>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {plugins.map((plugin) => (
          <li key={plugin.publicRef}>
            <Card>
              <CardTitle>{plugin.name}</CardTitle>
              <CardDescription>
                {plugin.pricing} · {plugin.priceLabel} · v{plugin.version}
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="warning">{devReviewLabel(plugin.reviewState)}</StatusPill>
              </div>
              <p className="mt-3 text-xs text-muted">
                Compat: {plugin.compatibility.join(", ")} · Scopes: {plugin.scopes.join(", ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={plugin.reviewState !== "APPROVED"}>
                  Install
                </Button>
                <Button size="sm" variant="secondary">
                  Security review
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {plugins.length === 0 ? (
        <p className="text-sm text-muted">No plugins in the demo catalog.</p>
      ) : null}
    </div>
  );
}
