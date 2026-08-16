import { z } from "zod";

export const coinPurchaseSchema = z.object({
  packageId: z.string().trim().min(1).max(32),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export type CoinPurchaseInput = z.infer<typeof coinPurchaseSchema>;
