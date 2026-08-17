import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeveloperPortalNav } from "@/features/developers/components/developer-portal-nav";
import { API_CATALOG, getApiSurface } from "@/features/developers/lib/api-catalog";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return API_CATALOG.map((surface) => ({ slug: surface.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const surface = getApiSurface(slug);
  return { title: surface ? `${surface.name} API` : "API not found" };
}

export default async function ApiSurfacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const surface = getApiSurface(slug);
  if (!surface) notFound();

  return (
    <div className="space-y-8">
      <DeveloperPortalNav current="/developers/apis" />

      <div>
        <Link href="/developers/apis" className="text-xs text-muted hover:text-foreground">
          ← API catalog
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{surface.name}</h1>
          <Badge tone={surface.status === "live" ? "live" : "default"}>
            {surface.status === "planned"
              ? "In development"
              : surface.status === "sandbox"
                ? "Sandbox"
                : "Live"}
          </Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">{surface.description}</p>
      </div>

      {surface.status === "planned" ? (
        <Card className="border-warning/25 bg-warning/[0.06]">
          <CardDescription className="mt-0 text-warning">
            This surface is documented ahead of build — there&rsquo;s no live endpoint yet.
            Nothing on this page is callable today.
          </CardDescription>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Use cases</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {surface.useCases.map((useCase) => (
              <li key={useCase} className="flex gap-2">
                <span className="text-neon-mint">•</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Capabilities</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {surface.capabilities.map((capability) => (
              <li key={capability} className="flex gap-2">
                <span className="text-neon-mint">•</span>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Pricing</CardTitle>
        <CardDescription>Coming soon — not yet set.</CardDescription>
      </Card>

      <Card>
        <CardTitle>Access</CardTitle>
        <CardDescription>
          Every API surface authenticates through the same developer API keys as the rest of the
          platform — no separate credential to manage.
        </CardDescription>
        <Link
          href="/developers/api-keys"
          className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
        >
          Manage API keys
        </Link>
      </Card>
    </div>
  );
}
