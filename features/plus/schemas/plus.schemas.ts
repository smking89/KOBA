import { z } from "zod";
import { PLUS_PLAN_CODES } from "@/features/plus/lib/plans";

const idempotency = z.string().trim().min(8).max(128);

export const plusCheckoutSchema = z
  .object({
    planCode: z.enum(PLUS_PLAN_CODES),
    idempotencyKey: idempotency,
    priceId: z.never().optional(),
    amount: z.never().optional(),
  })
  .strict();

export const plusPortalSchema = z
  .object({
    idempotencyKey: idempotency.optional(),
  })
  .strict();

export const plusCancelSchema = z
  .object({
    idempotencyKey: idempotency,
  })
  .strict();

export const plusReactivateSchema = z
  .object({
    idempotencyKey: idempotency,
  })
  .strict();

export const plusActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    planCode: z.enum(PLUS_PLAN_CODES).optional(),
    planId: z.string().trim().min(1).max(64).optional(),
    interval: z.enum(["MONTHLY", "ANNUAL"]).optional(),
    idempotencyKey: idempotency.optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    idempotencyKey: idempotency.optional(),
  }),
  z.object({
    action: z.literal("portal"),
    idempotencyKey: idempotency.optional(),
  }),
  z.object({
    action: z.literal("reactivate"),
    idempotencyKey: idempotency.optional(),
  }),
]);

export const adminPlusSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
});

export const adminPlusReconcileSchema = z
  .object({
    publicRef: z.string().trim().min(8).max(40),
  })
  .strict();

export const adminPlusGrantSchema = z
  .object({
    kobaIdentityId: z.string().trim().min(8).max(64),
    code: z.string().trim().min(3).max(64),
    reason: z.string().trim().min(8).max(500),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export type PlusCheckoutInput = z.infer<typeof plusCheckoutSchema>;
export type PlusActionInput = z.infer<typeof plusActionSchema>;
