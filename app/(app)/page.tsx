import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Market & Trade",
    body: "List skins, maps, kits, and cosmetics with a real rarity tier — common through relic. Sell for KOBA Coins or trade rarity-matched, item for item.",
    href: "/market",
  },
  {
    title: "Groups, LFG & servers",
    body: "Run a group, post an LFG, and check live player counts and maps on the server directory before you queue up.",
    href: "/groups",
  },
  {
    title: "KOBAID",
    body: "One identity per account role — Player, Business, or Influencer. Switch modes from Settings; your KOBAID stays yours.",
    href: "/settings",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          The marketplace and social layer <span className="text-brand-gradient">for your server.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted md:text-lg">
          Trade skins, maps, and kits by rarity, find teammates on the LFG board, and track live
          server stats over RCON — all under one KOBAID. Generate original cosmetics with Aiden,
          or Boost a listing, shop, or server to push it up the feed.
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
                Take a look →
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
