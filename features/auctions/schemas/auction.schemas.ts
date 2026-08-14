import { z } from "zod";

export const placeBidSchema = z.object({
  amountCents: z.number().int().min(1).max(10_000_000),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
