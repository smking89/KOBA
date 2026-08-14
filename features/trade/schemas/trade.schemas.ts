import { z } from "zod";
import { isValidKobaId } from "@/features/koba-id/lib/format";
import { GAME_PLATFORMS, PRODUCT_RARITIES } from "@/features/marketplace/lib/catalog";

const tradeItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  game: z.string().trim().min(1).max(64),
  platform: z.enum(GAME_PLATFORMS),
  rarity: z.enum(PRODUCT_RARITIES),
  locked: z.boolean().optional(),
  eligible: z.boolean().optional(),
  eligibilityNote: z.string().trim().max(280).optional(),
  productId: z.string().trim().min(1).max(64).optional(),
});

const kobaIdField = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(isValidKobaId, "Enter a KOBAID.");

export const createTradeSchema = z.object({
  counterpartyKobaId: kobaIdField,
  note: z.string().trim().max(500).optional(),
  offered: z.array(tradeItemSchema).min(1).max(12),
  requested: z.array(tradeItemSchema).min(1).max(12),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;

export const transitionTradeSchema = z.object({
  action: z.enum(["accept", "reject", "cancel", "counter", "dispute", "complete"]),
  note: z.string().trim().max(500).optional(),
});

export type TransitionTradeInput = z.infer<typeof transitionTradeSchema>;
