import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { AuditAction } from "@/lib/generated/prisma/client";
import { DeveloperError } from "@/features/developers/lib/errors";
import { generateDevPurchaseRef } from "@/features/developers/lib/refs";
import type { z } from "zod";
import type { reviewSchema } from "@/features/developers/schemas/developer.schemas";

type ReviewInput = z.infer<typeof reviewSchema>;

export async function upsertProductReview(userId: string, slug: string, input: ReviewInput) {
  const product = await prisma.devProduct.findUnique({ where: { slug } });
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  if (product.ownerUserId === userId) {
    throw new DeveloperError("You cannot review your own product.", "FORBIDDEN");
  }
  const entitlement = await prisma.devEntitlement.findUnique({
    where: { userId_productId: { userId, productId: product.id } },
  });
  if (!entitlement || entitlement.revokedAt) {
    throw new DeveloperError("Only owners of this product can review it.", "FORBIDDEN");
  }

  const existing = await prisma.devProductReview.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  const review = existing
    ? await prisma.devProductReview.update({
        where: { id: existing.id },
        data: { rating: input.rating, body: input.body },
      })
    : await prisma.devProductReview.create({
        data: {
          productId: product.id,
          userId,
          rating: input.rating,
          body: input.body,
        },
      });

  const agg = await prisma.devProductReview.aggregate({
    where: { productId: product.id },
    _sum: { rating: true },
    _count: { rating: true },
  });
  await prisma.devProduct.update({
    where: { id: product.id },
    data: {
      ratingSum: agg._sum.rating ?? 0,
      ratingCount: agg._count.rating,
    },
  });
  return {
    rating: review.rating,
    body: review.body,
    updatedAt: review.updatedAt.toISOString(),
  };
}

export async function reportDeveloperProduct(userId: string, slug: string, reason: string) {
  const product = await prisma.devProduct.findUnique({ where: { slug } });
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  if (!reason.trim()) throw new DeveloperError("A report reason is required.", "INVALID");
  const publicRef = generateDevPurchaseRef().replace("DPUR", "DRPT");
  await prisma.contentReport.create({
    data: {
      publicRef,
      reporterUserId: userId,
      targetType: "DEV_PRODUCT",
      targetRef: product.publicRef,
      reason: reason.trim().slice(0, 500),
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.CONTENT_REPORTED,
    targetType: "DevProduct",
    targetId: product.id,
    metadata: { publicRef, slug },
  });
  return { publicRef };
}

export async function reportDeveloperReview(userId: string, reviewId: string, reason: string) {
  const review = await prisma.devProductReview.findUnique({ where: { id: reviewId } });
  if (!review) throw new DeveloperError("Review not found.", "NOT_FOUND");
  if (!reason.trim()) throw new DeveloperError("A report reason is required.", "INVALID");
  const publicRef = generateDevPurchaseRef().replace("DPUR", "DRPT");
  await prisma.contentReport.create({
    data: {
      publicRef,
      reporterUserId: userId,
      targetType: "DEV_PRODUCT",
      targetRef: review.id,
      reason: `review:${reason.trim()}`.slice(0, 500),
    },
  });
  return { publicRef };
}
