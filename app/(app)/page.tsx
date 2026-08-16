import Link from "next/link";
import { KobaBadgeArt } from "@/components/koba/koba-badge-art";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Market & Trade",
    body: "List skins, maps, kits, and cosmetics with a real rarity tier — common through relic. Sell for KOBA Coins or trade rarity-matched, item for item.",
    href: "/market",
    action: "Browse listings",
    mark: "M",
  },
  {
    title: "Groups, LFG & servers",
    body: "Run a group, post an LFG, and check live player counts and maps on the server directory before you queue up.",
    href: "/groups",
    action: "Find a group",
    mark: "C",
  },
  {
    title: "KOBAID",
    body: "One identity per account role — Player, Business, or Influencer. Switch modes from Settings; your KOBAID stays yours.",
    href: "/settings",
    action: "View KOBAID",
    mark: "K",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KobaBadgeArt mark="plus" size={28} />
          <KobaBadgeArt mark="charge" size={28} />
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neon-lime uppercase">
            Social marketplace
          </p>
        </div>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Trade what you build. <span className="text-brand-gradient">Play with your people.</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted md:text-base">
          KOBA is where your server&apos;s community buys, sells, and hangs out. Sign up, get your
          KOBAID, and switch between Player, Business, and Influencer whenever you need to.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/market" className={cn(buttonVariants({ variant: "primary" }))}>
            Explore Market
          </Link>
          <Link href="/lfg" className={cn(buttonVariants({ variant: "secondary" }))}>
            Open LFG
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title} className="flex h-full flex-col">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-bold text-background">
              {pillar.mark}
            </div>
            <CardTitle>{pillar.title}</CardTitle>
            <CardDescription className="flex-1">{pillar.body}</CardDescription>
            <div className="mt-4">
              <Link
                href={pillar.href}
                className="text-sm font-semibold text-neon-lime hover:underline"
              >
                {pillar.action} →
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
