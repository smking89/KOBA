import Link from "next/link";
import { KobaBadgeArt } from "@/components/koba/koba-badge-art";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Marketplace",
    body: "Skins, maps, monuments, kits, cosmetics — browse what's out there, see what's rare, and grab what you want.",
    href: "/market",
    action: "Browse listings",
    mark: "M",
  },
  {
    title: "Community",
    body: "Find your people. Join a group, post an LFG, and squad up for whatever you're playing.",
    href: "/groups",
    action: "Find a group",
    mark: "C",
  },
  {
    title: "Identity",
    body: "Your KOBAID is yours the moment you sign up — one per account type, and it never changes.",
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
