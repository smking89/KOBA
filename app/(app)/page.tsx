import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  ShoppingBag,
  Repeat2,
  Users,
  Server,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HomeTour } from "@/components/koba/home-tour";
import { cn } from "@/lib/utils";

const features: {
  title: string;
  body: string;
  href: string;
  action: string;
  icon: LucideIcon | "aiden";
  tourId?: string;
}[] = [
  {
    title: "Marketplace",
    body: "Skins, maps, kits, and cosmetics with a real rarity tier — Common through Relic. Buy outright, bid on live auctions, or grab a free drop.",
    href: "/market",
    action: "Browse listings",
    icon: ShoppingBag,
    tourId: "pillar-market",
  },
  {
    title: "Trade",
    body: "Anything you've bought can be traded too — rarity-matched, item for item, no downgrades.",
    href: "/trade",
    action: "Open trades",
    icon: Repeat2,
  },
  {
    title: "Groups & LFG",
    body: "Run a group for your community and post to the LFG board when you need a squad.",
    href: "/groups",
    action: "Find a group",
    icon: Users,
    tourId: "pillar-groups",
  },
  {
    title: "Live servers",
    body: "Real player counts and maps pulled straight from the server over RCON — not a guess.",
    href: "/servers",
    action: "Browse servers",
    icon: Server,
  },
  {
    title: "Aiden AI",
    body: "Generate original cosmetics with Aiden using KOBA Coins, then list what you make on the Marketplace.",
    href: "/aiden",
    action: "Open Aiden",
    icon: "aiden",
  },
  {
    title: "Boost",
    body: "Push a listing, shop, or server 3x in front of more players for a short window.",
    href: "/wallet",
    action: "Get Boost",
    icon: Zap,
    tourId: "pillar-kobaid",
  },
];

const steps = [
  { step: "1", title: "Create your account", body: "Sign up and set your account role." },
  { step: "2", title: "Set up your identity", body: "Player, Business, or Influencer — switch anytime from Settings." },
  { step: "3", title: "Jump in", body: "Browse the Marketplace, join a group, or post an LFG." },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="space-y-4">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Level up your server. <span className="text-brand-gradient">Play with your people.</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted md:text-base">
          The ultimate marketplace for console and PC game servers. Grab custom skins, monuments,
          and kits, then find your crew.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/market"
            data-tour="explore-market"
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            Explore Marketplace
          </Link>
          <Link
            href="/lfg"
            data-tour="open-lfg"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Open LFG
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neon-lime uppercase">
          What you can do
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="flex h-full flex-col"
              data-tour={feature.tourId}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-background">
                {feature.icon === "aiden" ? (
                  <Image
                    src="/brand/aiden/aiden-icon.png"
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] object-contain"
                    suppressHydrationWarning
                  />
                ) : (
                  <feature.icon className="h-5 w-5" aria-hidden />
                )}
              </div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription className="flex-1">{feature.body}</CardDescription>
              <div className="mt-4">
                <Link
                  href={feature.href}
                  className="text-sm font-semibold text-neon-lime hover:underline"
                >
                  {feature.action} →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neon-lime uppercase">
          How it works
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="rounded-2xl border border-border bg-surface p-5">
              <span className="font-mono text-xs text-muted">Step {item.step}</span>
              <p className="mt-2 text-base font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className={cn(buttonVariants({ variant: "primary" }))}>
            Create your account
          </Link>
        </div>
      </section>

      <Suspense fallback={null}>
        <HomeTour />
      </Suspense>
    </div>
  );
}
