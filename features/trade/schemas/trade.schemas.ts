import { z } from "zod";
import { isValidKobaId } from "@/features/koba-id/lib/format";

const kobaIdField = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(isValidKobaId, "Enter a KOBAID.");

export const createTradeSchema = z.object({
  counterpartyKobaId: kobaIdField,
  note: z.string().trim().max(500).optional(),
  offeredInventoryRefs: z.array(z.string().trim().min(8).max(40)).min(1).max(12),
  requestedInventoryRefs: z.array(z.string().trim().min(8).max(40)).min(1).max(12),
  idempotencyKey: z.string().trim().min(8).max(128),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;

export const counterTradeSchema = z.object({
  offeredInventoryRefs: z.array(z.string().trim().min(8).max(40)).min(1).max(12),
  requestedInventoryRefs: z.array(z.string().trim().min(8).max(40)).min(1).max(12),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export type CounterTradeInput = z.infer<typeof counterTradeSchema>;

export const tradeMutationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  note: z.string().trim().max(500).optional(),
});

export type TradeMutationInput = z.infer<typeof tradeMutationSchema>;

export const tradeReportSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export type TradeReportInput = z.infer<typeof tradeReportSchema>;
