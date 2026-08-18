import { z } from "zod";

const hashtag = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^#?[a-zA-Z0-9_]+$/, "Hashtags can only contain letters, numbers, and underscores.")
  .transform((tag) => (tag.startsWith("#") ? tag.slice(1) : tag).toLowerCase());

export const addShopBlacklistEntrySchema = z
  .object({
    targetUserId: z.string().min(1),
    reason: z.string().trim().min(3).max(1000),
    hashtags: z.array(hashtag).max(10).default([]),
    requestSocialRemoval: z.boolean().default(false),
  })
  .strict();
export type AddShopBlacklistEntryInput = z.infer<typeof addShopBlacklistEntrySchema>;

export const addPlatformBlacklistEntrySchema = z
  .object({
    targetType: z.enum(["USER", "SHOP"]),
    targetId: z.string().min(1),
    reason: z.string().trim().min(3).max(1000),
    hashtags: z.array(hashtag).max(10).default([]),
    requestSocialRemoval: z.boolean().default(false),
  })
  .strict();
export type AddPlatformBlacklistEntryInput = z.infer<typeof addPlatformBlacklistEntrySchema>;
