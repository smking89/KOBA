import { z } from "zod";

export const flagDisputeSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export type FlagDisputeInput = z.infer<typeof flagDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["RELEASE", "REFUND"]),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
