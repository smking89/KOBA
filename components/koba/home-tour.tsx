"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "koba-tour-completed";

type Step = { target: string; title: string; body: string };

const STEPS: Step[] = [
  {
    target: "explore-market",
    title: "The Market",
    body: "Skins, maps, and kits with a real rarity tier — Common through Relic. Buy outright, bid on live auctions, or grab a free drop.",
  },
  {
    target: "open-lfg",
    title: "Find your crew",
    body: "Post to the LFG board when you need a squad, or browse who's looking for one right now.",
  },
  {
    target: "pillar-market",
    title: "Trade what you own",
    body: "Anything you've bought can be traded too — rarity-matched, item for item.",
  },
  {
    target: "pillar-groups",
    title: "Groups & servers",
    body: "Run a group for your community and check live player counts and maps before you queue up — pulled straight from the server over RCON.",
  },
  {
    target: "pillar-kobaid",
    title: "One KOBAID, every mode",
    body: "Player, Business, or Influencer — switch modes from Settings any time. Your KOBAID and everything you own stays with you.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function hasCompletedTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // storage blocked — fail closed, don't nag
  }
}

function markTourCompleted(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // nothing to persist
  }
}

/**
 * Spotlight/coach-mark onboarding tour (client reference, 2026-08-16),
 * anchored to real elements on the homepage via data-tour attributes
 * rather than a floating modal disconnected from the actual UI.
 */
export function HomeTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (searchParams.get("tour") === "1" || !hasCompletedTour()) {
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const measure = useCallback(() => {
    const current = STEPS[step];
    if (!current) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const box = el.getBoundingClientRect();
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
  }, [step]);

  useEffect(() => {
    if (!open) return;
    const current = STEPS[step];
    if (!current) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [open, step, measure]);

  function close() {
    markTourCompleted();
    setOpen(false);
    if (searchParams.get("tour") === "1") {
      router.replace("/");
    }
  }

  const current = useMemo(() => STEPS[step], [step]);

  if (!open || !current) {
    return null;
  }

  const isLast = step === STEPS.length - 1;

  // Tooltip placement: below the target if there's room, otherwise above.
  const tooltipWidth = 320;
  const spaceBelow = rect ? window.innerHeight - rect.top - rect.height : 0;
  const placeBelow = !rect || spaceBelow > 200;
  const tooltipTop = rect
    ? placeBelow
      ? rect.top + rect.height + 16
      : rect.top - 16
    : window.innerHeight / 2;
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, 16), window.innerWidth - tooltipWidth - 16)
    : window.innerWidth / 2 - tooltipWidth / 2;

  return (
    <div className="fixed inset-0 z-50">
      {/* Spotlight: box-shadow cutout around the real element, or a full
       * dim if the target isn't on screen (e.g. mobile layout hid it). */}
      {rect ? (
        <div
          className="fixed rounded-lg transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(5, 5, 5, 0.8)",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-background/80" />
      )}

      <div
        className={cn(
          "fixed w-[320px] rounded-xl border border-neon-lime/40 bg-surface p-4 shadow-soft",
          !placeBelow && "-translate-y-full",
        )}
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold">{current.title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close tour"
            className="text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="mt-4 flex items-center justify-between">
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
