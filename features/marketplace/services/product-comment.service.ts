import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { isPlatformFunctionEnabled } from "@/features/platform-control/services/platform-function.service";
import { generateCommentRef } from "@/features/social/lib/refs";
import { ProductCommentError } from "@/features/marketplace/lib/comment-errors";

const authorSelect = {
  name: true,
  profile: { select: { displayName: true, handle: true } },
  kobaIdentities: { select: { code: true }, take: 1 },
} as const;

function displayName(user: {
  name: string | null;
  profile: { displayName: string | null } | null;
}): string {
  return user.profile?.displayName ?? user.name ?? "Player";
}

async function uniqueCommentRef(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const publicRef = generateCommentRef();
    const clash = await prisma.productComment.findUnique({ where: { publicRef } });
    if (!clash) {
      return publicRef;
    }
  }
  throw new ProductCommentError("Could not allocate a comment reference.", "NOT_FOUND");
}

export async function countProductComments(productId: string): Promise<number> {
  return prisma.productComment.count({
    where: { productId, moderationStatus: "LIVE" },
  });
}

export async function listProductComments(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) {
    throw new ProductCommentError("Listing not found.", "NOT_FOUND");
  }
  const comments = await prisma.productComment.findMany({
    where: { productId: product.id, moderationStatus: "LIVE" },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: authorSelect } },
  });
  return comments.map((comment) => ({
    publicRef: comment.publicRef,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: {
      name: displayName(comment.author),
      handle: comment.author.profile?.handle ?? null,
      kobaId: comment.author.kobaIdentities[0]?.code ?? null,
    },
  }));
}

export async function postProductComment(
  userId: string,
  slug: string,
  body: string,
  ipAddress?: string | null,
) {
  if (!(await isPlatformFunctionEnabled("SOCIAL_POSTING"))) {
    throw new ProductCommentError("Comments are temporarily disabled by KOBA staff.", "DISABLED");
  }
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) {
    throw new ProductCommentError("Listing not found.", "NOT_FOUND");
  }

  const publicRef = await uniqueCommentRef();
  const comment = await prisma.productComment.create({
    data: { publicRef, productId: product.id, authorUserId: userId, body },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.PRODUCT_COMMENT_POSTED,
    targetType: "Product",
    targetId: product.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });

  return { publicRef: comment.publicRef };
}
