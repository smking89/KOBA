import { z } from "zod";
import { DEV_PRODUCT_KINDS } from "@/features/developer-portal/lib/types";

export const createDevProductSchema = z.object({
  kind: z.enum(DEV_PRODUCT_KINDS),
  name: z.string().trim().min(2).max(80),
  pricing: z.enum(["FREE", "PAID"]).default("FREE"),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  version: z.string().trim().min(1).max(32).optional(),
  compatibility: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
  scopes: z.array(z.string().trim().min(1).max(64)).max(24).default([]),
});

export type CreateDevProductInput = z.infer<typeof createDevProductSchema>;
