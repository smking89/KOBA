import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Developers" };

export default function DevelopersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Developer marketplace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Applications and plugins for KOBA communities. No real API keys or plugin execution in
          this phase — security review states are presentation only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Installable apps with scopes and versions.</CardDescription>
          <Link
            href="/developers/apps"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Browse apps
          </Link>
        </Card>
        <Card>
          <CardTitle>Plugins</CardTitle>
          <CardDescription>Game/server plugins with compatibility metadata.</CardDescription>
          <Link
            href="/developers/plugins"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Browse plugins
          </Link>
        </Card>
      </div>

      <Card>
        <CardTitle>Dashboard placeholders</CardTitle>
        <CardDescription>Earnings, API keys, revocation — UI stubs.</CardDescription>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>API key created once — never shown again after issuance (future)</li>
          <li>Earnings placeholder for paid listings</li>
          <li>Install / revoke controls without side effects</li>
        </ul>
      </Card>
    </div>
  );
}
