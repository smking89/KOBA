import { z } from "zod";
import { POST_VISIBILITY, TAG_PRIVACY, TAG_TARGET_TYPES } from "@/features/social/lib/rules";

export const createPostSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  visibility: z.enum(POST_VISIBILITY).default("PUBLIC"),
  groupSlug: z.string().trim().min(1).max(64).optional(),
  mediaUrl: z.string().trim().url().max(500).optional(),
  tags: z
    .array(
      z.object({
        type: z.enum(TAG_TARGET_TYPES),
        slug: z.string().trim().min(1).max(64),
      }),
    )
    .max(8)
    .default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export const createStorySchema = z.object({
  body: z.string().trim().min(1).max(280),
  mediaUrl: z.string().trim().url().max(500).optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "STORY", "USER"]),
  targetRef: z.string().trim().min(2).max(64),
  reason: z.string().trim().min(8).max(280),
});

export const tagPrivacySchema = z.object({
  tagPrivacy: z.enum(TAG_PRIVACY),
  bio: z.string().trim().max(280).optional(),
});

export const PAGE_SIZE = 8;
export const MAX_PAGE_SIZE = 24;

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
  group: z.string().trim().max(64).optional(),
  handle: z.string().trim().min(1).max(64).optional(),
});

export function parseFeedQuery(input: Record<string, string | string[] | undefined>) {
  const scalar = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = feedQuerySchema.safeParse({
    page: scalar(input.page) || 1,
    pageSize: scalar(input.pageSize) || PAGE_SIZE,
    group: scalar(input.group) || undefined,
    handle: scalar(input.handle) || undefined,
  });
  return parsed.success ? parsed.data : { page: 1, pageSize: PAGE_SIZE };
}
