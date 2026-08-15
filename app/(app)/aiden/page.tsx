import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";

export const metadata = { title: "Aiden" };

export default function AidenLandingPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-neon-mint uppercase">Aiden</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">AI creator workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
        <p className="mt-2 text-xs text-muted">
          Structured for a future <span className="font-mono">aiden.koba.games</span> host without
          duplicating the app.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Generate</CardTitle>
          <CardDescription>
            Prompt a concept image, reserve KOBA Coins, and queue generation.
          </CardDescription>
          <Link
            href="/aiden/create"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Open generator
          </Link>
        </Card>
        <Card>
          <CardTitle>Library</CardTitle>
          <CardDescription>
            Private concept drafts. Marketplace review is optional and never automatic.
          </CardDescription>
          <Link
            href="/aiden/library"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-4 inline-flex")}
          >
            Open library
          </Link>
        </Card>
      </div>
    </div>
  );
}
