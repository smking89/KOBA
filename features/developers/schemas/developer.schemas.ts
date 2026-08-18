import { z } from "zod";
import { DEV_PRODUCT_KINDS } from "@/features/developer-portal/lib/types";
import { DEV_API_SCOPES } from "@/features/developers/lib/scopes";
import { DEV_WEBHOOK_EVENTS } from "@/features/developers/lib/webhook-events";

export const createDeveloperProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(48),
    description: z.string().trim().max(4000).default(""),
    websiteUrl: z.string().url().optional(),
    supportUrl: z.string().url().optional(),
    privacyUrl: z.string().url().optional(),
    termsUrl: z.string().url().optional(),
    contactEmail: z.string().trim().email().max(120),
    games: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
    platforms: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
    avatarUrl: z.string().url().optional(),
    bannerUrl: z.string().url().optional(),
  })
  .strict();

// Socials bio block (App Store submission flow, 2026-08-18) — a separate,
// smaller schema so it can be PATCHed independently of the full profile
// creation form.
export const updateDeveloperSocialsSchema = z
  .object({
    twitterUrl: z.string().url().max(300).optional(),
    githubUrl: z.string().url().max(300).optional(),
    youtubeUrl: z.string().url().max(300).optional(),
    discordServerUrl: z.string().url().max(300).optional(),
  })
  .strict();

export const createDeveloperAppSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000).default(""),
    environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
    scopes: z.array(z.enum(DEV_API_SCOPES)).min(1).max(8),
    redirectUris: z.array(z.string().url()).max(8).default([]),
    logoUrl: z.string().url().optional(),
  })
  .strict();

export const createApiKeySchema = z
  .object({
    applicationRef: z.string().trim().min(8).max(40),
    name: z.string().trim().min(2).max(64),
    scopes: z.array(z.enum(DEV_API_SCOPES)).min(1).max(8),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

export const createWebhookSchema = z
  .object({
    url: z.string().url(),
    events: z.array(z.enum(DEV_WEBHOOK_EVENTS)).min(1).max(8),
    applicationRef: z.string().trim().min(8).max(40).optional(),
  })
  .strict();

export const createDevProductSchema = z.object({
  kind: z.enum(DEV_PRODUCT_KINDS),
  category: z
    .enum([
      "DISCORD_BOT",
      "GAME_SERVER_PLUGIN",
      "SERVER_MANAGEMENT",
      "INTEGRATION",
      "DOWNLOADABLE_PACK",
      "API_SERVICE",
      "UTILITY",
      "THEME",
    ])
    .default("UTILITY"),
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(64)
    .optional(),
  shortDescription: z.string().trim().max(160).default(""),
  description: z.string().trim().max(8000).default(""),
  pricing: z.enum(["FREE", "PAID", "COMING_SOON"]).default("FREE"),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  priceCoins: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  version: z.string().trim().min(1).max(32).optional(),
  compatibility: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
  scopes: z.array(z.string().trim().min(1).max(64)).max(24).default([]),
  games: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
  operatingSystems: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
  serverPlatforms: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
  docsUrl: z.string().url().optional(),
  supportUrl: z.string().url().optional(),
  privacyUrl: z.string().url().optional(),
  // DISCORD_BOT submissions: the bot's own OAuth2 invite URL (parsed +
  // format-validated in developer.service.ts via discord-invite.ts).
  discordInviteUrl: z.string().url().max(500).optional(),
});

export type CreateDevProductInput = z.infer<typeof createDevProductSchema>;
export type CreateDeveloperProfileInput = z.infer<typeof createDeveloperProfileSchema>;
export type UpdateDeveloperSocialsInput = z.infer<typeof updateDeveloperSocialsSchema>;
export type CreateDeveloperAppInput = z.infer<typeof createDeveloperAppSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const createVersionSchema = z
  .object({
    semver: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/),
    changelog: z.string().trim().max(8000).default(""),
    channel: z.enum(["STABLE", "BETA", "ALPHA"]).default("STABLE"),
    gameVersions: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
    platforms: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
    requirements: z.string().trim().max(2000).default(""),
  })
  .strict();

export const purchaseSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

export const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().max(4000).default(""),
  })
  .strict();
