import { z } from "zod";

const hostSchema = z.string().trim().min(1).max(255);
const portSchema = z.number().int().min(1).max(65535);
const passwordSchema = z.string().min(1).max(256);
const accountPasswordSchema = z.string().min(1).max(256);
const idempotencySchema = z.string().trim().min(8).max(128).optional();

export const rustTestSchema = z.object({
  hostname: hostSchema,
  queryPort: portSchema.optional(),
  rconPort: portSchema,
  password: passwordSchema,
});

export const rustConnectSchema = rustTestSchema.extend({
  accountPassword: accountPasswordSchema,
  idempotencyKey: idempotencySchema,
});

export const rustRotateSchema = z.object({
  hostname: hostSchema.optional(),
  queryPort: portSchema.optional(),
  rconPort: portSchema.optional(),
  password: passwordSchema,
  accountPassword: accountPasswordSchema,
  idempotencyKey: idempotencySchema,
});

export const rustDisconnectSchema = z.object({
  accountPassword: accountPasswordSchema,
  idempotencyKey: idempotencySchema,
});

export const rustRefreshSchema = z.object({
  idempotencyKey: idempotencySchema,
});

export type RustTestInput = z.infer<typeof rustTestSchema>;
export type RustConnectInput = z.infer<typeof rustConnectSchema>;
export type RustRotateInput = z.infer<typeof rustRotateSchema>;
export type RustDisconnectInput = z.infer<typeof rustDisconnectSchema>;
