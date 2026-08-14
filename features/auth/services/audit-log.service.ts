import { AuditAction, type Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = {
  actorUserId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
