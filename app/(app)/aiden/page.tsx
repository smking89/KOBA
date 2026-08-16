import Link from "next/link";
import { PageHeader } from "@/components/koba/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";
import { requireAidenPage } from "@/features/aiden/lib/require-business";

export const metadata = { title: "Aiden" };

export default async function AidenLandingPage() {
  await requireAidenPage("/aiden");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Aiden"
        title="AI creator workspace"
        description={
          <>
            {AIDEN_DISCLAIMER}
            <p className="mt-2 text-xs">
              Structured for a future <span className="font-mono">aiden.koba.games</span> host
              without duplicating the app.
            </p>
          </>
        }
      />

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <Card className="flex h-full flex-col gap-4">
          <div>
            <CardTitle>Generate</CardTitle>
            <CardDescription>
              Prompt a concept image, reserve KOBA Coins, and queue generation.
            </CardDescription>
          </div>
          <Link
            href="/aiden/create"
            className={cn(buttonVariants({ size: "sm" }), "mt-auto inline-flex w-fit")}
          >
            Open generator
          </Link>
        </Card>
        <Card className="flex h-full flex-col gap-4">
          <div>
            <CardTitle>Library</CardTitle>
            <CardDescription>
              Private concept drafts. Marketplace review is optional and never automatic.
            </CardDescription>
          </div>
          <Link
            href="/aiden/library"
            className={cn(
              buttonVariants({ size: "sm", variant: "secondary" }),
              "mt-auto inline-flex w-fit",
            )}
          >
            Open library
          </Link>
        </Card>
      </div>
    </div>
  );
}
