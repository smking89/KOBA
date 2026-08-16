import { AuditAction, type PlatformFunctionKey } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  canManagePlatformFunctions,
  PLATFORM_FUNCTIONS,
} from "@/features/platform-control/lib/functions";

export class PlatformControlError extends Error {
  constructor(
    message: string,
    readonly code: "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "PlatformControlError";
  }
}

async function loadActorTypes(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  return actor?.kobaIdentities.map((row) => row.accountType) ?? [];
}

export type PlatformFunctionState = {
  key: PlatformFunctionKey;
  label: string;
  description: string;
  enabled: boolean;
  note: string | null;
  updatedAt: Date | null;
};

/** Merges the static registry with whatever DB overrides exist. A function
 * with no row is enabled by default (see PlatformFunctionFlag doc comment
 * in schema.prisma). */
export async function listPlatformFunctions(): Promise<PlatformFunctionState[]> {
  const flags = await prisma.platformFunctionFlag.findMany();
  const byKey = new Map(flags.map((flag) => [flag.key, flag]));

  return PLATFORM_FUNCTIONS.map((fn) => {
    const flag = byKey.get(fn.key);
    return {
      key: fn.key,
      label: fn.label,
      description: fn.description,
      enabled: flag?.enabled ?? true,
      note: flag?.note ?? null,
      updatedAt: flag?.updatedAt ?? null,
    };
  });
}

/**
 * Runtime gate for the enforcement points that actually call it (see
 * features/payments/lib/stripe.ts and
 * features/shops/services/product-description-assist.service.ts). Fails
 * CLOSED: any DB error is treated as disabled, since this guards real
 * money/API-cost paths and a silent bypass on an outage is worse than a
 * false block. No caching — correctness (a superadmin's toggle takes
 * effect immediately) matters more than shaving one query here.
 */
export async function isPlatformFunctionEnabled(key: PlatformFunctionKey): Promise<boolean> {
  try {
    const flag = await prisma.platformFunctionFlag.findUnique({ where: { key } });
    return flag?.enabled ?? true;
  } catch (error) {
    console.error(`platform-function flag lookup failed for ${key}, failing closed`, error);
    return false;
  }
}

export async function setPlatformFunctionEnabled(
  actorUserId: string,
  key: PlatformFunctionKey,
  enabled: boolean,
  note?: string | null,
  ipAddress?: string | null,
): Promise<PlatformFunctionState> {
  const actorTypes = await loadActorTypes(actorUserId);
  if (!canManagePlatformFunctions(actorTypes)) {
    throw new PlatformControlError(
      "Only KOBA Superadmin can control platform functions.",
      "FORBIDDEN",
    );
  }

  const descriptor = PLATFORM_FUNCTIONS.find((fn) => fn.key === key);
  if (!descriptor) {
    throw new PlatformControlError("Unknown platform function.", "NOT_FOUND");
  }

  const flag = await prisma.platformFunctionFlag.upsert({
    where: { key },
    update: { enabled, note: note ?? null, updatedByUserId: actorUserId },
    create: { key, enabled, note: note ?? null, updatedByUserId: actorUserId },
  });

  await writeAuditLog({
    actorUserId,
    action: enabled
      ? AuditAction.PLATFORM_FUNCTION_ENABLED
      : AuditAction.PLATFORM_FUNCTION_DISABLED,
    targetType: "PlatformFunctionFlag",
    targetId: key,
    metadata: { key, enabled, note: note ?? null },
    ipAddress: ipAddress ?? null,
  });

  return {
    key: flag.key,
    label: descriptor.label,
    description: descriptor.description,
    enabled: flag.enabled,
    note: flag.note,
    updatedAt: flag.updatedAt,
  };
}
