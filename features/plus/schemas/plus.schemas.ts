import { z } from "zod";
import { PLUS_PLAN_INTERVALS } from "@/features/plus/lib/types";

export const plusActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    planId: z.string().trim().min(1).max(64).optional(),
    interval: z.enum(PLUS_PLAN_INTERVALS).optional(),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
]);

export type PlusActionInput = z.infer<typeof plusActionSchema>;
