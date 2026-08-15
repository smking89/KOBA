import { z } from "zod";

export const plusActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    idempotencyKey: z.string().trim().min(8).max(80),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
]);

export type PlusActionInput = z.infer<typeof plusActionSchema>;
