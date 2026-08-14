import { randomBytes } from "node:crypto";
import { AuditAction, type KobaAccountType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { createIdentityWithCollisionRetry } from "@/features/koba-id/lib/collision-retry";
import {
  isPublicAccountType,
  isStaffAccountType,
  type RandomBytesFn,
} from "@/features/koba-id/lib/format";
import { canIssueStaffRole } from "@/features/koba-id/lib/staff-auth";
import { KobaIdError } from "@/features/koba-id/services/koba-id-error";

export { KobaIdError } from "@/features/koba-id/services/koba-id-error";
export { canIssueStaffRole } from "@/features/koba-id/lib/staff-auth";

function toRandomBytesFn(fn: RandomBytesFn = (size) => randomBytes(size)): RandomBytesFn {
  return fn;
}

export async function mintPublicKobaId(
  userId: string,
  accountType: KobaAccountType,
  ipAddress?: string | null,
  randomBytesFn?: RandomBytesFn,
) {
  if (!isPublicAccountType(accountType)) {
    throw new KobaIdError(
      "Staff identities cannot be created through public registration.",
      "STAFF_NOT_PUBLIC",
    );
  }

  const existing = await prisma.kobaIdentity.findUnique({
    where: { userId_accountType: { userId, accountType } },
  });

  if (existing) {
    return existing;
  }

  const identity = await createIdentityWithCollisionRetry({
    accountType,
    randomBytesFn: toRandomBytesFn(randomBytesFn),
    create: (code) =>
      prisma.kobaIdentity.create({
        data: { userId, accountType, code },
      }),
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.KOBAID_MINTED,
    targetType: "KobaIdentity",
    targetId: identity.id,
    metadata: { code: identity.code, accountType },
    ipAddress: ipAddress ?? null,
  });

  return identity;
}

export async function mintStaffKobaId(input: {
  actorUserId: string;
  targetUserId: string;
  accountType: KobaAccountType;
  ipAddress?: string | null;
  randomBytesFn?: RandomBytesFn;
}) {
  if (!isStaffAccountType(input.accountType)) {
    throw new KobaIdError("This endpoint only issues staff identities.", "PUBLIC_NOT_STAFF");
  }

  const actorIdentities = await prisma.kobaIdentity.findMany({
    where: { userId: input.actorUserId },
    select: { accountType: true },
  });

  const actorTypes = actorIdentities.map((row) => row.accountType);

  if (!canIssueStaffRole(actorTypes, input.accountType)) {
    throw new KobaIdError("You are not allowed to issue this staff identity.", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({ where: { id: input.targetUserId } });
  if (!target) {
    throw new KobaIdError("Target user was not found.", "USER_NOT_FOUND");
  }

  const existing = await prisma.kobaIdentity.findUnique({
    where: {
      userId_accountType: { userId: input.targetUserId, accountType: input.accountType },
    },
  });

  if (existing) {
    throw new KobaIdError("That user already has this staff identity.", "ALREADY_EXISTS");
  }

  const identity = await createIdentityWithCollisionRetry({
    accountType: input.accountType,
    randomBytesFn: toRandomBytesFn(input.randomBytesFn),
    create: (code) =>
      prisma.kobaIdentity.create({
        data: { userId: input.targetUserId, accountType: input.accountType, code },
      }),
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: AuditAction.KOBAID_ISSUED_STAFF,
    targetType: "KobaIdentity",
    targetId: identity.id,
    metadata: {
      code: identity.code,
      accountType: input.accountType,
      targetUserId: input.targetUserId,
    },
    ipAddress: input.ipAddress ?? null,
  });

  return identity;
}

export async function ensurePublicKobaId(
  userId: string,
  accountType: KobaAccountType,
  ipAddress?: string | null,
) {
  return mintPublicKobaId(userId, accountType, ipAddress);
}
