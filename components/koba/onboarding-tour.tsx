"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "koba-tour-completed";

type TourStep = {
  title: string;
  body: string;
  action?: { label: string; href: string };
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to KOBA",
    body: "One KOBAID per account role — Player, Business, or Influencer. Switch modes any time from Settings; your KOBAID and everything you own stays with you.",
  },
  {
    title: "The Market",
    body: "Skins, maps, and kits with a real rarity tier — Common through Relic. Buy outright, bid on live auctions, or grab a free drop. Own something? You can trade it too, rarity-matched.",
    action: { label: "Browse the Market", href: "/market" },
  },
  {
    title: "Groups & LFG",
    body: "Run or join a group for your community, and post to the LFG board when you need a squad or want to plug your server.",
    action: { label: "Find your squad", href: "/groups" },
  },
  {
    title: "Servers",
    body: "Live player counts and maps over RCON, pulled straight from the server — not a guess.",
    action: { label: "Browse servers", href: "/servers" },
  },
  {
    title: "Aiden & Coins",
    body: "Generate original cosmetics with Aiden using KOBA Coins, then list what you make on the Market. Boost a listing, shop, or server to push it 3x in front of more players.",
    action: { label: "Open your wallet", href: "/wallet" },
  },
];

/** Reads the localStorage completion flag imperatively (client-only) so
 * the tour never flashes on the server-rendered pass and only appears
 * for a browser that hasn't dismissed it before. */
function hasCompletedTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // storage blocked (private mode etc.) — fail closed, don't nag
  }
}

function markTourCompleted(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // storage blocked — nothing to persist, the tour just won't remember
  }
}

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasCompletedTour()) {
      setOpen(true);
    }
  }, []);

  function close() {
    markTourCompleted();
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  const current = STEPS[step];
  if (!current) {
    return null;
  }
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{current.title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close tour"
            className="text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current.body}</p>
        {current.action ? (
          <Link
            href={current.action.href}
            onClick={close}
            className="mt-3 inline-block text-sm font-semibold text-neon-lime hover:underline"
          >
            {current.action.label} →
          </Link>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  index === step ? "bg-neon-lime" : "bg-border",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={close}>
                Skip
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? close() : setStep((s) => s + 1))}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
