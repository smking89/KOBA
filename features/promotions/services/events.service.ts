import { prisma } from "@/lib/db";

export async function recordPromotionEvent(input: {
  type: string;
  campaignId?: string | null;
  participationId?: string | null;
  orderId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
}) {
  try {
    await prisma.promotionEvent.create({
      data: {
        type: input.type,
        campaignId: input.campaignId ?? null,
        participationId: input.participationId ?? null,
        orderId: input.orderId ?? null,
        actorUserId: input.actorUserId ?? null,
        payloadJson: JSON.stringify(input.payload ?? {}),
        idempotencyKey: input.idempotencyKey.slice(0, 128),
      },
    });
  } catch {
    const existing = await prisma.promotionEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey.slice(0, 128) },
    });
    if (existing) return existing;
    throw new Error("Could not record promotion event.");
  }
}

export async function notifyPromotion(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
}) {
  await prisma.promotionNotice.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href ?? null,
    },
  });
}

export async function listPromotionNotices(userId: string, take = 30) {
  return prisma.promotionNotice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
