import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";
import { AidenBrandMark, AidenProductLogo } from "@/components/koba/aiden-brand-mark";
import { requireAidenPage } from "@/features/aiden/lib/require-business";

export const metadata = { title: "Aiden" };

export default async function AidenLandingPage() {
  await requireAidenPage("/aiden");

  return (
    <div className="space-y-8">
      <div>
        <AidenBrandMark showWordmark={false} className="mb-3" />
        <p className="font-mono text-xs tracking-[0.2em] text-neon-mint uppercase">Aiden</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">AI creator workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
        <p className="mt-2 text-xs text-muted">
          Business-only. Structured for a future <span className="font-mono">aiden.koba.games</span>{" "}
          host without duplicating the app.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-center py-6">
          <AidenProductLogo product="VEST" />
        </Card>
        <Card className="flex items-center justify-center py-6">
          <AidenProductLogo product="GRAFT" />
        </Card>
        <Card className="flex items-center justify-center py-6">
          <AidenProductLogo product="TERRA" />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Generate</CardTitle>
          <CardDescription>Prompt, game, asset type, and Coin cost preview.</CardDescription>
          <Link
            href="/aiden/generate"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            Open generator
          </Link>
        </Card>
        <Card>
          <CardTitle>Library</CardTitle>
          <CardDescription>Private assets, technical status, publish-to-shop.</CardDescription>
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
