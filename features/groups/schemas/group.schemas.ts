import { z } from "zod";
import { GROUP_MEMBER_ROLES, GROUP_VISIBILITIES } from "@/features/groups/lib/access";
import { isValidKobaId } from "@/features/koba-id/lib/format";

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(64),
  bio: z.string().trim().min(8).max(500),
  visibility: z.enum(GROUP_VISIBILITIES),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

const kobaIdField = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(isValidKobaId, "Enter a KOBAID.");

export const groupModerateSchema = z.object({
  action: z.enum(["approve", "deny", "invite", "kick", "ban", "unban", "set_role"]),
  kobaId: kobaIdField,
  role: z.enum(GROUP_MEMBER_ROLES).optional(),
});

export type GroupModerateInput = z.infer<typeof groupModerateSchema>;
