import { z } from "zod";
import { DIRECTORY_GAMES } from "@/features/servers/lib/game-catalogue";
import { SERVER_CAPABILITIES } from "@/features/servers/lib/types";

const gameSlugs = DIRECTORY_GAMES.map((g) => g.slug) as [string, ...string[]];

export const createServerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  game: z.string().trim().min(1).max(64),
  platformFamily: z.enum(["PC", "CONSOLE"]),
  region: z.string().trim().min(2).max(64),
  country: z.string().trim().max(64).optional(),
  timezone: z.string().trim().max(64).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  joinInfo: z.string().trim().max(280).optional(),
  shopId: z.string().trim().min(1).max(64).optional(),
  hostname: z.string().trim().max(255).optional(),
  queryPort: z.number().int().min(1).max(65535).optional(),
  gamePort: z.number().int().min(1).max(65535).optional(),
  hideResolvedIp: z.boolean().optional(),
  maxPlayers: z.number().int().min(1).max(100_000).optional(),
  /** @deprecated use hostname */
  host: z.string().trim().max(255).optional(),
  /** @deprecated use gamePort */
  port: z.number().int().min(1).max(65535).optional(),
  capabilities: z.array(z.enum(SERVER_CAPABILITIES)).max(20).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;

export const updateServerSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  region: z.string().trim().min(2).max(64).optional(),
  country: z.string().trim().max(64).nullable().optional(),
  timezone: z.string().trim().max(64).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  joinInfo: z.string().trim().max(280).nullable().optional(),
  shopId: z.string().trim().min(1).max(64).nullable().optional(),
  hostname: z.string().trim().max(255).nullable().optional(),
  queryPort: z.number().int().min(1).max(65535).nullable().optional(),
  gamePort: z.number().int().min(1).max(65535).nullable().optional(),
  hideResolvedIp: z.boolean().optional(),
  maxPlayers: z.number().int().min(1).max(100_000).nullable().optional(),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export type UpdateServerInput = z.infer<typeof updateServerSchema>;

export const directoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  game: z.string().trim().max(64).optional(),
  platform: z.enum(["PC", "CONSOLE"]).optional(),
  region: z.string().trim().max(64).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "DEGRADED", "UNKNOWN"]).optional(),
  tag: z.string().trim().max(32).optional(),
  verified: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true" || v === "1")),
  hasSlots: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true" || v === "1")),
  cursor: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(24),
});

export type DirectoryQueryInput = z.infer<typeof directoryQuerySchema>;

export const staffServerActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("restore"),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export type StaffServerActionInput = z.infer<typeof staffServerActionSchema>;

export const upsertRconSchema = z.object({
  action: z.literal("rotate").optional(),
  password: z.string().min(1).max(256),
  host: z.string().trim().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

export const rconActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test"),
  }),
  z.object({
    action: z.literal("rotate"),
    password: z.string().min(1).max(256),
    host: z.string().trim().min(1).max(255).optional(),
    port: z.number().int().min(1).max(65535).optional(),
  }),
  z.object({
    action: z.literal("disconnect"),
  }),
]);

export type RconActionInput = z.infer<typeof rconActionSchema>;

export { gameSlugs };
