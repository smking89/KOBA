"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { AchievementBadge } from "@/features/achievements/components/achievement-badge";
import type { UnlockedAchievement } from "@/features/achievements/services/achievement.service";
import type { ProductRarity } from "@/features/marketplace/lib/catalog";

/**
 * Fires once on mount when the self-view profile load just granted new
 * badges (see evaluateAndGrantAchievements, called server-side in
 * app/(app)/u/[handle]/page.tsx for the signed-in owner). A burst for
 * everyone, plus a slightly bigger/longer one for Legendary/Relic unlocks
 * to match their in-place animated glow.
 */
export function AchievementConfetti({ unlocked }: { unlocked: UnlockedAchievement[] }) {
  const [visible, setVisible] = useState(unlocked.length > 0);

  useEffect(() => {
    if (unlocked.length === 0) return;
    const isBigUnlock = unlocked.some((badge) => badge.rarity === "LEGENDARY" || badge.rarity === "RELIC");

    confetti({
      particleCount: isBigUnlock ? 160 : 90,
      spread: isBigUnlock ? 100 : 70,
      startVelocity: isBigUnlock ? 55 : 40,
      origin: { y: 0.3 },
      colors: ["#f5341e", "#ff7a1a", "#ffc02e"],
    });
    if (isBigUnlock) {
      const timeout = setTimeout(() => {
        confetti({ particleCount: 100, spread: 120, origin: { y: 0.25 }, colors: ["#ffb648", "#ff2469"] });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [unlocked]);

  if (!visible || unlocked.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-xl border border-white/10 bg-surface-3/95 px-4 py-3 shadow-soft backdrop-blur"
    >
      <div className="flex -space-x-2">
        {unlocked.slice(0, 3).map((badge) => (
          <AchievementBadge
            key={badge.slug}
            name={badge.name}
            description={badge.description}
            rarity={badge.rarity as ProductRarity}
            icon={badge.icon}
            numeral={badge.numeral}
            unlocked
            size="sm"
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {unlocked.length === 1 ? "Badge unlocked!" : `${unlocked.length} badges unlocked!`}
        </p>
        <p className="truncate text-xs text-muted">{unlocked.map((badge) => badge.name).join(", ")}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="ml-1 shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-white/8 hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}
