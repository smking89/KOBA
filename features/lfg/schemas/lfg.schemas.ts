import { z } from "zod";
import { GAME_PLATFORMS } from "@/features/marketplace/lib/catalog";
import { LFG_MIC, LFG_REGIONS, LFG_SKILLS } from "@/features/lfg/lib/rules";
import { isValidKobaId } from "@/features/koba-id/lib/format";

export const createLfgSchema = z.object({
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(8).max(500),
  gameSlug: z.string().trim().min(1).max(64),
  platform: z.enum(GAME_PLATFORMS),
  region: z.enum(LFG_REGIONS),
  timezone: z.string().trim().min(2).max(64),
  skillLevel: z.enum(LFG_SKILLS),
  mic: z.enum(LFG_MIC),
  availability: z.string().trim().min(2).max(80),
  slotsTotal: z.number().int().min(2).max(20),
  expiresInHours: z.number().int().min(1).max(72),
});

export type CreateLfgInput = z.infer<typeof createLfgSchema>;

export const lfgQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  game: z.string().trim().max(64).optional(),
  platform: z.enum(GAME_PLATFORMS).optional(),
  region: z.enum(LFG_REGIONS).optional(),
  skill: z.enum(LFG_SKILLS).optional(),
  mic: z.enum(LFG_MIC).optional(),
});

export type LfgQuery = z.infer<typeof lfgQuerySchema>;

export function parseLfgQuery(input: Record<string, string | string[] | undefined>): LfgQuery {
  const scalar = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = lfgQuerySchema.safeParse({
    q: scalar(input.q) || undefined,
    game: scalar(input.game) || undefined,
    platform: scalar(input.platform) || undefined,
    region: scalar(input.region) || undefined,
    skill: scalar(input.skill) || undefined,
    mic: scalar(input.mic) || undefined,
  });
  return parsed.success ? parsed.data : {};
}

export const lfgModerateSchema = z.object({
  action: z.enum(["accept", "deny", "cancel"]),
  kobaId: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(isValidKobaId)
    .optional(),
});
