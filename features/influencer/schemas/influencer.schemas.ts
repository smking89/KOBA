import { z } from "zod";
import {
  MAX_FIXED_CENTS,
  MAX_PROMO_BPS,
  PROMO_PAYOUT_TYPES,
} from "@/features/influencer/lib/types";

export const createReferralCodeSchema = z.object({
  productSlug: z.string().trim().min(1).max(96),
});

export const updateShopPromoSchema = z
  .object({
    influencerEligible: z.boolean(),
    payoutType: z.enum(PROMO_PAYOUT_TYPES),
    payoutValue: z.number().int().min(0).max(MAX_FIXED_CENTS),
  })
  .superRefine((value, ctx) => {
    if (value.payoutType === "PERCENT_BPS" && value.payoutValue > MAX_PROMO_BPS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent payout cannot exceed 25%.",
        path: ["payoutValue"],
      });
    }
  });

export type CreateReferralCodeInput = z.infer<typeof createReferralCodeSchema>;
export type UpdateShopPromoInput = z.infer<typeof updateShopPromoSchema>;
