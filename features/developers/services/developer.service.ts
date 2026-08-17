import { createHash } from "node:crypto";
import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import type { DevProductKind, DevProductView } from "@/features/developer-portal/lib/types";
import {
  DEV_MAX_ARTIFACT_BYTES,
  artifactBytesMatchExtension,
  isAllowedArtifact,
  sanitizeArtifactFilename,
} from "@/features/developers/lib/artifacts";
import { DeveloperError } from "@/features/developers/lib/errors";
import { requireRole } from "@/features/developers/lib/identity";
import { scanDeveloperArtifact } from "@/features/developers/lib/malware-scan";
import {
  generateDevProductRef,
  generateDevVersionRef,
  slugify,
} from "@/features/developers/lib/refs";
import {
  assertDevProductTransition,
  isPublicDevState,
} from "@/features/developers/lib/state-machine";
import type { CreateDevProductInput } from "@/features/developers/schemas/developer.schemas";
import { getMyDeveloperProfile } from "@/features/developers/services/portal.service";
import {
  DEVELOPER_SIGNED_URL_TTL_SECONDS,
  signDeveloperObjectUrl,
  storeDeveloperObject,
} from "@/features/developers/lib/storage";

function priceLabel(
  pricing: "FREE" | "PAID" | "COMING_SOON",
  priceCoins: bigint,
  priceCents: number,
): string {
  if (pricing === "COMING_SOON") return "Coming soon";
  if (pricing === "FREE" || priceCoins <= 0n) return "Free";
  if (priceCoins > 0n) return `${priceCoins.toString()} KOBA Coins`;
  return `$${(priceCents / 100).toFixed(2)}`;
}

function toView(
  product: {
    publicRef: string;
    kind: DevProductKind;
    name: string;
    pricing: "FREE" | "PAID" | "COMING_SOON";
    priceCents: number;
    priceCoins?: bigint;
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
    priceLabel: priceLabel(product.pricing, product.priceCoins ?? 0n, product.priceCents),
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
              {
                reviewState: {
                  in: ["APPROVED", "PUBLISHED", "SECURITY_REVIEW", "IN_REVIEW", "SUBMITTED"],
                },
              },
            ],
          }
        : { reviewState: "PUBLISHED", suspendedAt: null }),
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

export async function searchPublicProducts(query: {
  q?: string;
  category?: string;
  game?: string;
  platform?: string;
  pricing?: "FREE" | "PAID";
  /** "popular" sorts by real install/download count (the storefront's
   * "Popular" rail); default is most-recently-updated. */
  sort?: "recent" | "popular";
  take?: number;
}) {
  const products = await prisma.devProduct.findMany({
    where: {
      reviewState: "PUBLISHED",
      suspendedAt: null,
      ...(query.category ? { category: query.category as never } : {}),
      ...(query.pricing ? { pricing: query.pricing } : {}),
      ...(query.game ? { games: { has: query.game } } : {}),
      ...(query.platform ? { serverPlatforms: { has: query.platform } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { shortDescription: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { profile: { select: { slug: true, displayName: true, verified: true } } },
    orderBy: query.sort === "popular" ? { downloadCount: "desc" } : { updatedAt: "desc" },
    take: query.take ?? 48,
  });
  return products.map((product) => ({
    ...toView(product),
    slug: product.slug,
    category: product.category,
    shortDescription: product.shortDescription,
    games: product.games,
    kobaOfficial: product.kobaOfficial,
    verifiedPublisher: product.profile?.verified ?? false,
    publisherSlug: product.profile?.slug ?? null,
    publisherName: product.profile?.displayName ?? null,
    iconUrl: product.iconUrl,
    downloadCount: product.downloadCount,
    ratingCount: product.ratingCount,
    rating:
      product.ratingCount > 0 ? Number((product.ratingSum / product.ratingCount).toFixed(2)) : null,
  }));
}

export async function getPublicProduct(slug: string) {
  const product = await prisma.devProduct.findUnique({
    where: { slug },
    include: {
      profile: true,
      versions: { orderBy: { createdAt: "desc" }, take: 20 },
      reviews: { orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });
  if (!product || !isPublicDevState(product.reviewState) || product.suspendedAt) {
    throw new DeveloperError("Product not found.", "NOT_FOUND");
  }
  return product;
}

export async function createProduct(
  userId: string,
  input: CreateDevProductInput,
): Promise<DevProductView> {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) throw new DeveloperError("Create a developer profile first.", "INVALID");
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  const priceCoins = input.pricing === "PAID" ? BigInt(input.priceCoins ?? "40") : 0n;
  if (input.pricing === "PAID" && priceCoins <= 0n) {
    throw new DeveloperError("Paid products need a KOBA Coin price.", "INVALID");
  }
  const baseSlug = input.slug ?? slugify(input.name);
  let slug = baseSlug;
  if (await prisma.devProduct.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${generateDevProductRef().slice(-6).toLowerCase()}`;
  }
  const product = await prisma.devProduct.create({
    data: {
      publicRef: generateDevProductRef(),
      slug,
      ownerUserId: userId,
      profileId: mine.profileId,
      kind: input.kind,
      category: input.category,
      name: input.name,
      shortDescription: input.shortDescription,
      description: input.description,
      pricing: input.pricing,
      priceCents: input.priceCents ?? 0,
      priceCoins,
      version: input.version ?? "0.1.0",
      compatibility: input.compatibility,
      scopes: input.scopes,
      games: input.games,
      operatingSystems: input.operatingSystems,
      serverPlatforms: input.serverPlatforms,
      docsUrl: input.docsUrl ?? null,
      supportUrl: input.supportUrl ?? null,
      privacyUrl: input.privacyUrl ?? null,
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
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  if (product.ownerUserId !== userId) {
    if (!product.profileId)
      throw new DeveloperError("Only the owner can submit for review.", "FORBIDDEN");
    await requireRole(userId, product.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  }
  assertDevProductTransition(product.reviewState, "SUBMITTED");
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
    metadata: { publicRef, previous: product.reviewState, next: "SUBMITTED" },
    ipAddress: ipAddress ?? null,
  });
  return toView(updated);
}

export async function createProductVersion(
  userId: string,
  productRef: string,
  input: {
    semver: string;
    changelog: string;
    channel: "STABLE" | "BETA" | "ALPHA";
    gameVersions: string[];
    platforms: string[];
    requirements: string;
  },
) {
  const product = await prisma.devProduct.findUnique({ where: { publicRef: productRef } });
  if (!product?.profileId) throw new DeveloperError("Product not found.", "NOT_FOUND");
  await requireRole(userId, product.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  return prisma.devProductVersion.create({
    data: {
      publicRef: generateDevVersionRef(),
      productId: product.id,
      semver: input.semver,
      changelog: input.changelog,
      channel: input.channel,
      gameVersions: input.gameVersions,
      platforms: input.platforms,
      requirements: input.requirements,
      reviewState: "DRAFT",
    },
  });
}

export async function attachArtifact(
  userId: string,
  versionRef: string,
  file: { filename: string; mime: string; bytes: Buffer },
) {
  const version = await prisma.devProductVersion.findUnique({
    where: { publicRef: versionRef },
    include: { product: true },
  });
  if (!version?.product.profileId) throw new DeveloperError("Version not found.", "NOT_FOUND");
  await requireRole(userId, version.product.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  const filename = sanitizeArtifactFilename(file.filename);
  if (!isAllowedArtifact(filename, file.mime)) {
    throw new DeveloperError("Artifact type is not allowed.", "INVALID");
  }
  if (file.bytes.byteLength <= 0 || file.bytes.byteLength > DEV_MAX_ARTIFACT_BYTES) {
    throw new DeveloperError("Artifact exceeds the size limit.", "INVALID");
  }
  if (!artifactBytesMatchExtension(file.bytes, filename)) {
    throw new DeveloperError("Artifact content does not match its file type.", "INVALID");
  }
  const scan = await scanDeveloperArtifact(file.bytes, file.mime);
  if (scan.scanned && !scan.clean) {
    throw new DeveloperError(scan.reason ?? "Artifact failed scanning.", "INVALID");
  }
  const stored = await storeDeveloperObject({
    userId,
    publicRef: version.publicRef,
    mime: file.mime,
    filename,
    bytes: file.bytes,
  });
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  return prisma.devProductArtifact.create({
    data: {
      versionId: version.id,
      storageKey: stored.key,
      sha256,
      byteSize: file.bytes.byteLength,
      mimeType: file.mime,
      filename,
      status: "QUARANTINE",
      bytes: stored.stored === "inline" ? new Uint8Array(file.bytes) : null,
    },
  });
}

export async function signArtifactDownload(userId: string, versionRef: string) {
  const entitlement = await prisma.devEntitlement.findFirst({
    where: { userId, revokedAt: null, product: { versions: { some: { publicRef: versionRef } } } },
    include: {
      product: {
        include: { versions: { where: { publicRef: versionRef }, include: { artifacts: true } } },
      },
    },
  });
  if (!entitlement) throw new DeveloperError("No download entitlement.", "FORBIDDEN");
  if (entitlement.product.suspendedAt) {
    throw new DeveloperError("Downloads are blocked while this product is suspended.", "FORBIDDEN");
  }
  const version = entitlement.product.versions[0];
  const artifact =
    version?.artifacts.find((row) => row.status === "APPROVED") ?? version?.artifacts[0];
  if (!version || (version.reviewState !== "APPROVED" && version.reviewState !== "PUBLISHED")) {
    throw new DeveloperError("This version is not approved for download.", "FORBIDDEN");
  }
  if (!artifact) throw new DeveloperError("No artifact available.", "NOT_FOUND");
  await prisma.devProduct.update({
    where: { id: entitlement.productId },
    data: { downloadCount: { increment: 1 } },
  });
  const url = await signDeveloperObjectUrl(
    artifact.storageKey,
    DEVELOPER_SIGNED_URL_TTL_SECONDS,
    artifact.filename,
  );
  if (url) return { mode: "redirect" as const, url, filename: artifact.filename };
  if (!artifact.bytes) throw new DeveloperError("Artifact is not available.", "NOT_FOUND");
  return {
    mode: "bytes" as const,
    bytes: Buffer.from(artifact.bytes),
    mime: artifact.mimeType,
    filename: artifact.filename,
  };
}

export async function listMyProducts(userId: string) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) return [];
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "DEVELOPER", "SUPPORT", "ANALYST"]);
  const products = await prisma.devProduct.findMany({
    where: { profileId: mine.profileId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { installs: { where: { revokedAt: null } } } } },
  });
  return products.map((product) => ({
    ...toView(product),
    slug: product.slug,
    category: product.category,
    shortDescription: product.shortDescription,
  }));
}

export async function getOwnedProduct(userId: string, productIdOrSlug: string) {
  const product = await prisma.devProduct.findFirst({
    where: {
      OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }, { publicRef: productIdOrSlug }],
    },
    include: { versions: { orderBy: { createdAt: "desc" }, include: { artifacts: true } } },
  });
  if (!product?.profileId) throw new DeveloperError("Product not found.", "NOT_FOUND");
  await requireRole(userId, product.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  return product;
}

export async function installProduct(userId: string, publicRef: string) {
  const product = await prisma.devProduct.findUnique({ where: { publicRef } });
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  if (product.reviewState !== "APPROVED" && product.reviewState !== "PUBLISHED") {
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
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  const existing = await prisma.devInstall.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (!existing) throw new DeveloperError("Install not found.", "NOT_FOUND");
  await prisma.devInstall.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  return { ok: true as const, productRef: publicRef };
}
