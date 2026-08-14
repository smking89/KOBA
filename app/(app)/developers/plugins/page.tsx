import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { devReviewLabel } from "@/features/developer-portal/lib/types";
import { listProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "Developer plugins" };

export default async function DeveloperPluginsPage() {
  const session = await auth();
  const plugins = (await listProducts("PLUGIN", session?.user.id).catch(() => [])).filter(
    (product) => product.kind === "PLUGIN",
  );

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
                Compat: {plugin.compatibility.join(", ") || "—"} · Scopes:{" "}
                {plugin.scopes.join(", ") || "—"}
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
        <p className="text-sm text-muted">No plugins yet.</p>
      ) : null}
    </div>
  );
}
