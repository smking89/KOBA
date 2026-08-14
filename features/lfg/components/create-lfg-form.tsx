"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import { GAME_PLATFORMS, PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";
import {
  LFG_MIC,
  LFG_MIC_LABEL,
  LFG_REGIONS,
  LFG_REGION_LABEL,
  LFG_SKILLS,
  LFG_SKILL_LABEL,
} from "@/features/lfg/lib/rules";
import { createLfgSchema } from "@/features/lfg/schemas/lfg.schemas";
import type { z } from "zod";

type CreateLfgInput = z.infer<typeof createLfgSchema>;
const selectClass = "h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm";

export function CreateLfgForm({ games }: { games: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLfgInput>({
    resolver: zodResolver(createLfgSchema),
    defaultValues: {
      platform: "STEAM",
      region: "NA",
      skillLevel: "CASUAL",
      mic: "REQUIRED",
      timezone: "America/New_York",
      slotsTotal: 5,
      expiresInHours: 24,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const response = await fetch("/api/lfg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        slotsTotal: Number(values.slotsTotal),
        expiresInHours: Number(values.expiresInHours),
      }),
    });
    const payload = (await response.json()) as { error?: string; publicRef?: string };
    if (!response.ok) {
      setFormError(payload.error ?? "Could not create LFG post.");
      return;
    }
    if (payload.publicRef) {
      router.push(`/lfg/${payload.publicRef}`);
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <FormField id="title" label="Title" error={errors.title?.message}>
        <Input id="title" maxLength={80} {...register("title")} />
      </FormField>
      <FormField id="body" label="Details" error={errors.body?.message}>
        <Textarea id="body" rows={4} maxLength={500} {...register("body")} />
      </FormField>
      <FormField id="gameSlug" label="Game" error={errors.gameSlug?.message}>
        <select id="gameSlug" className={selectClass} {...register("gameSlug")}>
          <option value="">Select a game</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="platform" label="Platform" error={errors.platform?.message}>
          <select id="platform" className={selectClass} {...register("platform")}>
            {GAME_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABEL[platform]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="region" label="Region" error={errors.region?.message}>
          <select id="region" className={selectClass} {...register("region")}>
            {LFG_REGIONS.map((region) => (
              <option key={region} value={region}>
                {LFG_REGION_LABEL[region]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="skillLevel" label="Skill" error={errors.skillLevel?.message}>
          <select id="skillLevel" className={selectClass} {...register("skillLevel")}>
            {LFG_SKILLS.map((skill) => (
              <option key={skill} value={skill}>
                {LFG_SKILL_LABEL[skill]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="mic" label="Microphone" error={errors.mic?.message}>
          <select id="mic" className={selectClass} {...register("mic")}>
            {LFG_MIC.map((mic) => (
              <option key={mic} value={mic}>
                {LFG_MIC_LABEL[mic]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id="timezone" label="Timezone" error={errors.timezone?.message}>
        <Input id="timezone" maxLength={64} {...register("timezone")} />
      </FormField>
      <FormField id="availability" label="Availability" error={errors.availability?.message}>
        <Input
          id="availability"
          maxLength={80}
          placeholder="Weeknights 8PM"
          {...register("availability")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="slotsTotal" label="Party size" error={errors.slotsTotal?.message}>
          <Input
            id="slotsTotal"
            type="number"
            min={2}
            max={20}
            {...register("slotsTotal", { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          id="expiresInHours"
          label="Expires in hours"
          error={errors.expiresInHours?.message}
        >
          <Input
            id="expiresInHours"
            type="number"
            min={1}
            max={72}
            {...register("expiresInHours", { valueAsNumber: true })}
          />
        </FormField>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Posting…" : "Post LFG"}
      </Button>
    </form>
  );
}
