"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { GAME_PLATFORMS, PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";
import {
  LFG_MIC,
  LFG_MIC_LABEL,
  LFG_REGIONS,
  LFG_REGION_LABEL,
  LFG_SKILLS,
  LFG_SKILL_LABEL,
} from "@/features/lfg/lib/rules";
import type { LfgQuery } from "@/features/lfg/schemas/lfg.schemas";

const selectClass = "h-10 rounded-md border border-border bg-surface-2 px-3 text-sm";

export function LfgFilters({
  query,
  games,
}: {
  query: LfgQuery;
  games: { slug: string; name: string }[];
}) {
  const router = useRouter();

  function apply(form: FormData) {
    const params = new URLSearchParams();
    for (const field of ["q", "game", "platform", "region", "skill", "mic"] as const) {
      const value = String(form.get(field) ?? "").trim();
      if (value) {
        params.set(field, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/lfg?${qs}` : "/lfg");
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        apply(new FormData(event.currentTarget));
      }}
    >
      <Input
        name="q"
        defaultValue={query.q ?? ""}
        placeholder="Search parties…"
        aria-label="Search LFG"
      />
      <div className="flex flex-wrap gap-2">
        <select
          name="game"
          defaultValue={query.game ?? ""}
          className={selectClass}
          aria-label="Game"
        >
          <option value="">All games</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </select>
        <select
          name="platform"
          defaultValue={query.platform ?? ""}
          className={selectClass}
          aria-label="Platform"
        >
          <option value="">All platforms</option>
          {GAME_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </option>
          ))}
        </select>
        <select
          name="region"
          defaultValue={query.region ?? ""}
          className={selectClass}
          aria-label="Region"
        >
          <option value="">All regions</option>
          {LFG_REGIONS.map((region) => (
            <option key={region} value={region}>
              {LFG_REGION_LABEL[region]}
            </option>
          ))}
        </select>
        <select
          name="skill"
          defaultValue={query.skill ?? ""}
          className={selectClass}
          aria-label="Skill"
        >
          <option value="">Any skill</option>
          {LFG_SKILLS.map((skill) => (
            <option key={skill} value={skill}>
              {LFG_SKILL_LABEL[skill]}
            </option>
          ))}
        </select>
        <select
          name="mic"
          defaultValue={query.mic ?? ""}
          className={selectClass}
          aria-label="Microphone"
        >
          <option value="">Any mic</option>
          {LFG_MIC.map((mic) => (
            <option key={mic} value={mic}>
              {LFG_MIC_LABEL[mic]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-semibold"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
