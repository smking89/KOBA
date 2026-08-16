import { z } from "zod";
import { SERVER_CAPABILITIES } from "@/features/servers/lib/types";

export const createServerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  game: z.string().trim().min(1).max(64),
  platformFamily: z.enum(["PC", "CONSOLE"]),
  region: z.string().trim().min(2).max(64),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  joinInfo: z.string().trim().max(280).optional(),
  shopId: z.string().trim().min(1).max(64).optional(),
  capabilities: z.array(z.enum(SERVER_CAPABILITIES)).max(12).optional(),
  host: z.string().trim().max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;

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

export const serverBioSchema = z.object({
  bio: z.string().trim().min(1).max(280),
});

export type ServerBioInput = z.infer<typeof serverBioSchema>;

export const giveKitSchema = z.object({
  kitName: z.string().trim().min(1).max(64),
  gamertag: z.string().trim().min(1).max(64),
});

export type GiveKitInput = z.infer<typeof giveKitSchema>;
