import { z } from "zod";
import { MESSAGE_KINDS } from "@/features/messages/lib/rules";

export const startConversationSchema = z.object({
  handle: z.string().trim().min(2).max(32),
});

export const sendMessageSchema = z
  .object({
    kind: z.enum(MESSAGE_KINDS).default("TEXT"),
    body: z.string().trim().max(2000).optional(),
    mediaUrl: z.string().trim().url().max(500).optional(),
    mediaDurationMs: z.number().int().min(100).max(120_000).optional(),
    productSlug: z.string().trim().min(1).max(64).optional(),
    vanish: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "TEXT" && !value.body?.trim()) {
      ctx.addIssue({ code: "custom", message: "Text messages need a body.", path: ["body"] });
    }
    if ((value.kind === "VOICE" || value.kind === "ATTACHMENT") && !value.mediaUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Media messages need an https URL.",
        path: ["mediaUrl"],
      });
    }
    if (value.kind === "PRODUCT" && !value.productSlug) {
      ctx.addIssue({
        code: "custom",
        message: "Product cards need a product slug.",
        path: ["productSlug"],
      });
    }
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const reportConversationSchema = z.object({
  reason: z.string().trim().min(8).max(280),
  messageRef: z.string().trim().min(2).max(64).optional(),
});
