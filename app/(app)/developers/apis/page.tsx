import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { API_CATALOG } from "@/features/developers/lib/api-catalog";

export const metadata = { title: "API catalog" };

export default function ApiCatalogPage() {
  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/apis" />
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neon-mint">
          Developer APIs
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">API catalog</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Six API surfaces, each its own versioned product with its own docs and sandbox — not one
          monolithic dev API. All six are in development; none have a live endpoint yet, so
          nothing here is callable today. Pricing is coming soon.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {API_CATALOG.map((surface) => (
          <Link key={surface.slug} href={`/developers/apis/${surface.slug}`} className="block">
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{surface.name}</CardTitle>
                <Badge tone={surface.status === "live" ? "live" : "default"}>
                  {surface.status === "planned"
                    ? "In development"
                    : surface.status === "sandbox"
                      ? "Sandbox"
                      : "Live"}
                </Badge>
              </div>
              <CardDescription>{surface.tagline}</CardDescription>
              <p className="mt-4 font-mono text-xs text-muted">Pricing — Coming soon</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
