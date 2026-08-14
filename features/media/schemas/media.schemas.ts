import { z } from "zod";

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/webm",
  "video/mp4",
  "video/webm",
] as const;

export const presignMediaSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(ALLOWED_UPLOAD_CONTENT_TYPES),
  folder: z.enum(["posts", "stories", "messages", "products"]).optional(),
});

export type PresignMediaInput = z.infer<typeof presignMediaSchema>;
