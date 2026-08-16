"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
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
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect name="game" defaultValue={query.game ?? ""} aria-label="Game">
          <option value="">All games</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="platform" defaultValue={query.platform ?? ""} aria-label="Platform">
          <option value="">All platforms</option>
          {GAME_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="region" defaultValue={query.region ?? ""} aria-label="Region">
          <option value="">All regions</option>
          {LFG_REGIONS.map((region) => (
            <option key={region} value={region}>
              {LFG_REGION_LABEL[region]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="skill" defaultValue={query.skill ?? ""} aria-label="Skill">
          <option value="">Any skill</option>
          {LFG_SKILLS.map((skill) => (
            <option key={skill} value={skill}>
              {LFG_SKILL_LABEL[skill]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="mic" defaultValue={query.mic ?? ""} aria-label="Microphone">
          <option value="">Any mic</option>
          {LFG_MIC.map((mic) => (
            <option key={mic} value={mic}>
              {LFG_MIC_LABEL[mic]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
      </div>
    </form>
  );
}
