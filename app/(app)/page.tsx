import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Marketplace",
    body: "Skins, maps, monuments, kits, and cosmetics with rarity-aware product cards.",
    href: "/market",
  },
  {
    title: "Community",
    body: "Groups and Looking-for-Group boards tuned for survival and sandbox titles.",
    href: "/groups",
  },
  {
    title: "Identity",
    body: "One immutable KOBAID per account type — minted on the server, never chosen.",
    href: "/settings",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <Badge tone="live">Phase 4 · KOBAID</Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Trade what you build. <span className="text-brand-gradient">Play with your people.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted md:text-lg">
          KOBA is the social marketplace for game-server communities. Sign in to mint your KOBAID
          and switch between Player, Business, and Influencer modes.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/market" className={cn(buttonVariants({ variant: "primary" }))}>
            Explore Market
          </Link>
          <Link href="/lfg" className={cn(buttonVariants({ variant: "secondary" }))}>
            Open LFG
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title}>
            <CardTitle>{pillar.title}</CardTitle>
            <CardDescription>{pillar.body}</CardDescription>
            <div className="mt-4">
              <Link
                href={pillar.href}
                className="text-sm font-semibold text-neon-lime hover:underline"
              >
                Preview route →
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
