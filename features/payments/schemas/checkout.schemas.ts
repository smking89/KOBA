import { z } from "zod";

export const checkoutSchema = z.object({
  slug: z.string().trim().min(1).max(96),
  quantity: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().trim().min(8).max(80),
  referralCode: z.string().trim().min(3).max(72).optional(),
  promoCode: z.string().trim().min(3).max(32).optional(),
  campaignReferralToken: z.string().trim().min(8).max(80).optional(),
  /// Required (checked in checkout.service.ts, not here — depends on
  /// the product being purchased) only when the product has
  /// rconKitName set — the in-game handle direct-RCON auto-delivery
  /// targets.
  buyerGameHandle: z.string().trim().min(1).max(64).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
