import { z } from "zod";
import { AIDEN_ASSET_TYPES } from "@/features/aiden/lib/types";

export const createAidenJobSchema = z.object({
  prompt: z.string().trim().min(4).max(2000),
  game: z.string().trim().min(1).max(64),
  platform: z.string().trim().min(1).max(32),
  assetType: z.enum(AIDEN_ASSET_TYPES),
});

export type CreateAidenJobInput = z.infer<typeof createAidenJobSchema>;

export const aidenJobActionSchema = z.object({
  action: z.enum(["cancel"]),
});

export type AidenJobActionInput = z.infer<typeof aidenJobActionSchema>;
