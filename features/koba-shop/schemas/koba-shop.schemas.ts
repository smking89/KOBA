import { z } from "zod";

export const cosmeticCheckoutSchema = z.object({
  slug: z.string().trim().min(1).max(96),
  idempotencyKey: z.string().trim().min(8).max(80),
});
export type CosmeticCheckoutInput = z.infer<typeof cosmeticCheckoutSchema>;

export const reviewApplicationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional(),
});
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;

export const equipCosmeticSchema = z.object({ cosmeticOwnershipId: z.string().min(1) });
export type EquipCosmeticInput = z.infer<typeof equipCosmeticSchema>;

export const unequipCosmeticSchema = z.object({
  subType: z.enum(["AVATAR_DECORATION", "PROFILE_EFFECT", "NAMEPLATE", "PROFILE_FRAME", "EMOJI"]),
});
export type UnequipCosmeticInput = z.infer<typeof unequipCosmeticSchema>;
