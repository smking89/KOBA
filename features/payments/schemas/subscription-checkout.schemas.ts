import { z } from "zod";

export const subscriptionCheckoutSchema = z.object({
  slug: z.string().trim().min(1).max(96),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export type SubscriptionCheckoutInput = z.infer<typeof subscriptionCheckoutSchema>;
