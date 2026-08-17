import Link from "next/link";
import Image from "next/image";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Developers" };

export default function DevelopersPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Image src="/brand/koba-logo.png" alt="" width={48} height={48} className="rounded-md" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neon-mint">Developers</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Build on KOBA</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Register a publisher, create sandbox apps, issue hashed API keys, and submit plugins or
            digital products for staff review. KOBA never executes third-party plugin code.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Publisher portal</CardTitle>
          <CardDescription>Profiles, team roles, sandbox apps, and keys.</CardDescription>
          <Link
            href="/developers/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Create publisher
          </Link>
        </Card>
        <Card>
          <CardTitle>API catalog</CardTitle>
          <CardDescription>
            AI Behavior, Faction Simulation, Event Trigger, Logistics, NPC Personality, Pack
            Metadata.
          </CardDescription>
          <Link
            href="/developers/apis"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Browse APIs
          </Link>
        </Card>
        <Card>
          <CardTitle>App marketplace</CardTitle>
          <CardDescription>Browse published bots, plugins, and tools.</CardDescription>
          <Link
            href="/apps"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Browse apps
          </Link>
        </Card>
        <Card>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Manage products, webhooks, and submissions.</CardDescription>
          <Link
            href="/developers/dashboard"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Open dashboard
          </Link>
        </Card>
      </div>
    </div>
  );
}
