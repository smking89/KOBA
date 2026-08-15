import { z } from "zod";

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit authenticator code.");

export const recoveryOrTotpSchema = z.string().trim().min(6).max(32);

export const enrollStartSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const enrollConfirmSchema = z.object({
  code: totpCodeSchema,
});

export const challengeVerifySchema = z.object({
  code: recoveryOrTotpSchema,
});

export const stepUpSchema = z.object({
  code: totpCodeSchema,
});

export const disableMfaSchema = z.object({
  password: z.string().min(1),
  code: recoveryOrTotpSchema,
  confirm: z.literal(true),
});

export const regenerateRecoverySchema = z.object({
  password: z.string().min(1),
  code: totpCodeSchema,
});

export const adminResetSchema = z.object({
  email: z.string().trim().email(),
  reason: z.string().trim().min(8).max(500),
  code: totpCodeSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  code: totpCodeSchema.optional(),
});

export const loginStartSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
