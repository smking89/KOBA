import { z } from "zod";
import { PUBLIC_ACCOUNT_TYPES, STAFF_ACCOUNT_TYPES } from "@/features/koba-id/lib/format";

export const publicAccountTypeSchema = z.enum(PUBLIC_ACCOUNT_TYPES);

export const switchAccountSchema = z.object({
  accountType: publicAccountTypeSchema,
});

export const addAccountTypeSchema = z.object({
  accountType: publicAccountTypeSchema,
});

export const issueStaffKobaIdSchema = z.object({
  email: z.string().trim().email(),
  accountType: z.enum(STAFF_ACCOUNT_TYPES),
});

export const markKobaIdRevealedSchema = z.object({
  acknowledged: z.literal(true),
});
