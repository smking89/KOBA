import { ACHIEVEMENT_CATALOG } from "@/features/achievements/lib/catalog";
import { AchievementBadge } from "@/features/achievements/components/achievement-badge";

const CATEGORY_LABEL: Record<string, string> = {
  ACCOUNT_AGE: "Tenure",
  TRADING: "Trading",
  MARKETPLACE: "Marketplace",
  COMMUNITY: "Community",
  SPECIAL: "Special",
};

const CATEGORY_ORDER = ["SPECIAL", "ACCOUNT_AGE", "TRADING", "MARKETPLACE", "COMMUNITY"];

/**
 * Discord-style badge shelf: the full catalog renders every time, unlocked
 * entries in full color, everything else greyed out as a "not earned yet"
 * preview — badges are earned, never bought or sold, so there's no
 * purchase affordance here at all.
 */
export function AchievementBadgeGrid({ unlockedSlugs }: { unlockedSlugs: string[] }) {
  const unlocked = new Set(unlockedSlugs);
  const byCategory = new Map<string, typeof ACHIEVEMENT_CATALOG>();
  for (const entry of ACHIEVEMENT_CATALOG) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => (
        <div key={category}>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            {CATEGORY_LABEL[category] ?? category}
          </p>
          <div className="flex flex-wrap gap-4">
            {byCategory.get(category)!.map((entry) => (
              <AchievementBadge
                key={entry.slug}
                name={entry.name}
                description={entry.description}
                rarity={entry.rarity}
                icon={entry.icon}
                numeral={entry.numeral}
                unlocked={unlocked.has(entry.slug)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
