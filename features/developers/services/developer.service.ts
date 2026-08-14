import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import type { DevProductKind, DevProductView } from "@/features/developer-portal/lib/types";
import { DeveloperError } from "@/features/developers/lib/errors";
import { generateDevProductRef } from "@/features/developers/lib/refs";
import type { CreateDevProductInput } from "@/features/developers/schemas/developer.schemas";

function priceLabel(pricing: "FREE" | "PAID", priceCents: number): string {
  if (pricing === "FREE" || priceCents <= 0) return "Free";
  return `$${(priceCents / 100).toFixed(2)}`;
}

function toView(
  product: {
    publicRef: string;
    kind: DevProductKind;
    name: string;
    pricing: "FREE" | "PAID";
    priceCents: number;
    version: string;
    compatibility: string[];
    scopes: string[];
    reviewState: DevProductView["reviewState"];
    _count?: { installs: number };
  },
  installCount?: number,
): DevProductView {
  return {
    publicRef: product.publicRef,
    kind: product.kind,
    name: product.name,
    pricing: product.pricing,
    priceLabel: priceLabel(product.pricing, product.priceCents),
    version: product.version,
    compatibility: product.compatibility,
    scopes: product.scopes,
    reviewState: product.reviewState,
    installs: installCount ?? product._count?.installs ?? 0,
  };
}

export async function listProducts(
  kind?: DevProductKind,
  viewerUserId?: string,
): Promise<DevProductView[]> {
  const products = await prisma.devProduct.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(viewerUserId
        ? {
            OR: [
              { ownerUserId: viewerUserId },
              { reviewState: { in: ["APPROVED", "SECURITY_REVIEW", "IN_REVIEW", "SUBMITTED"] } },
            ],
          }
        : { reviewState: "APPROVED" }),
    },
    orderBy: { createdAt: "desc" },
    take: 64,
    include: {
      _count: {
        select: { installs: { where: { revokedAt: null } } },
      },
    },
  });
  return products.map((product) => toView(product));
}

export async function createProduct(
  userId: string,
  input: CreateDevProductInput,
): Promise<DevProductView> {
  const priceCents =
    input.pricing === "PAID" ? (input.priceCents ?? 499) : (input.priceCents ?? 0);
  const product = await prisma.devProduct.create({
    data: {
      publicRef: generateDevProductRef(),
      ownerUserId: userId,
      kind: input.kind,
      name: input.name,
      pricing: input.pricing,
      priceCents,
      version: input.version ?? "0.1.0",
      compatibility: input.compatibility,
      scopes: input.scopes,
      reviewState: "DRAFT",
    },
    include: { _count: { select: { installs: true } } },
  });
  return toView(product);
}

export async function submitForReview(
  userId: string,
  publicRef: string,
  ipAddress?: string | null,
): Promise<DevProductView> {
  const product = await prisma.devProduct.findUnique({
    where: { publicRef },
    include: { _count: { select: { installs: { where: { revokedAt: null } } } } },
  });
  if (!product) {
    throw new DeveloperError("Product not found.", "NOT_FOUND");
  }
  if (product.ownerUserId !== userId) {
    throw new DeveloperError("Only the owner can submit for review.", "FORBIDDEN");
  }
  if (product.reviewState !== "DRAFT" && product.reviewState !== "REJECTED") {
    throw new DeveloperError("Product is not eligible for submission.", "INVALID");
  }

  const updated = await prisma.devProduct.update({
    where: { id: product.id },
    data: { reviewState: "SUBMITTED" },
    include: { _count: { select: { installs: { where: { revokedAt: null } } } } },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_PRODUCT_SUBMITTED,
    targetType: "DevProduct",
    targetId: product.id,
    metadata: { publicRef },
    ipAddress: ipAddress ?? null,
  });

  return toView(updated);
}

export async function installProduct(userId: string, publicRef: string) {
  const product = await prisma.devProduct.findUnique({ where: { publicRef } });
  if (!product) {
    throw new DeveloperError("Product not found.", "NOT_FOUND");
  }
  if (product.reviewState !== "APPROVED") {
    throw new DeveloperError("Only approved products can be installed.", "INVALID");
  }

  const install = await prisma.devInstall.upsert({
    where: { productId_userId: { productId: product.id, userId } },
    create: { productId: product.id, userId },
    update: { revokedAt: null },
  });

  return { ok: true as const, productRef: publicRef, installId: install.id };
}

export async function revokeInstall(userId: string, publicRef: string) {
  const product = await prisma.devProduct.findUnique({ where: { publicRef } });
  if (!product) {
    throw new DeveloperError("Product not found.", "NOT_FOUND");
  }

  const existing = await prisma.devInstall.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (!existing) {
    throw new DeveloperError("Install not found.", "NOT_FOUND");
  }

  await prisma.devInstall.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return { ok: true as const, productRef: publicRef };
}
