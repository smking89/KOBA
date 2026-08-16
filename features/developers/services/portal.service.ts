import { AuditAction, type DeveloperMemberRole } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  generateApiKey,
  hashApiKeySecret,
  parseApiKey,
  hashesEqual,
} from "@/features/developers/lib/api-keys";
import { DeveloperError } from "@/features/developers/lib/errors";
import { resolveDeveloperIdentity, requireRole } from "@/features/developers/lib/identity";
import { generateDevAppRef } from "@/features/developers/lib/refs";
import { canManageSecrets } from "@/features/developers/lib/roles";
import { assertScopes } from "@/features/developers/lib/scopes";
import type {
  CreateApiKeyInput,
  CreateDeveloperAppInput,
  CreateDeveloperProfileInput,
} from "@/features/developers/schemas/developer.schemas";

function publicProfile(profile: {
  slug: string;
  displayName: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  supportUrl: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  verified: boolean;
  suspendedAt: Date | null;
  games: string[];
  platforms: string[];
}) {
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    description: profile.description,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    websiteUrl: profile.websiteUrl,
    supportUrl: profile.supportUrl,
    privacyUrl: profile.privacyUrl,
    termsUrl: profile.termsUrl,
    verified: profile.verified,
    suspended: Boolean(profile.suspendedAt),
    games: profile.games,
    platforms: profile.platforms,
  };
}

export async function createDeveloperProfile(
  userId: string,
  input: CreateDeveloperProfileInput,
  ipAddress?: string | null,
) {
  const identity = await resolveDeveloperIdentity(userId);
  const existing = await prisma.developerProfile.findFirst({
    where: { OR: [{ slug: input.slug }, { ownerUserId: userId }] },
  });
  if (existing?.slug === input.slug) {
    throw new DeveloperError("That publisher slug is taken.", "CONFLICT");
  }
  if (existing?.ownerUserId === userId) {
    throw new DeveloperError("This account already has a developer profile.", "CONFLICT");
  }

  const profile = await prisma.developerProfile.create({
    data: {
      slug: input.slug,
      displayName: input.displayName,
      description: input.description,
      websiteUrl: input.websiteUrl ?? null,
      supportUrl: input.supportUrl ?? null,
      privacyUrl: input.privacyUrl ?? null,
      termsUrl: input.termsUrl ?? null,
      contactEmail: input.contactEmail,
      games: input.games,
      platforms: input.platforms,
      avatarUrl: input.avatarUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      ownerUserId: userId,
      kobaIdentityId: identity.identity.id,
      members: { create: { userId, role: "OWNER" } },
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_PROFILE_CREATED,
    targetType: "DeveloperProfile",
    targetId: profile.id,
    metadata: { slug: profile.slug },
    ipAddress: ipAddress ?? null,
  });

  return publicProfile(profile);
}

export async function getPublicDeveloperProfile(slug: string) {
  const profile = await prisma.developerProfile.findUnique({
    where: { slug },
    include: {
      products: {
        where: { reviewState: "PUBLISHED", suspendedAt: null },
        select: { slug: true, name: true, pricing: true, category: true, kobaOfficial: true },
        take: 24,
      },
    },
  });
  if (!profile || profile.suspendedAt) {
    throw new DeveloperError("Publisher not found.", "NOT_FOUND");
  }
  return { ...publicProfile(profile), products: profile.products };
}

export async function getMyDeveloperProfile(userId: string) {
  const member = await prisma.developerMember.findFirst({
    where: { userId },
    include: { profile: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) return null;
  return {
    ...publicProfile(member.profile),
    role: member.role,
    profileId: member.profileId,
    contactEmail:
      member.role === "OWNER" || member.role === "ADMIN" ? member.profile.contactEmail : null,
  };
}

export async function addDeveloperMember(
  actorUserId: string,
  slug: string,
  targetUserId: string,
  role: DeveloperMemberRole,
) {
  const profile = await prisma.developerProfile.findUnique({ where: { slug } });
  if (!profile) throw new DeveloperError("Publisher not found.", "NOT_FOUND");
  await requireRole(actorUserId, profile.id, ["OWNER", "ADMIN"]);
  if (role === "OWNER")
    throw new DeveloperError("Ownership cannot be assigned this way.", "FORBIDDEN");
  await prisma.developerMember.upsert({
    where: { profileId_userId: { profileId: profile.id, userId: targetUserId } },
    create: { profileId: profile.id, userId: targetUserId, role },
    update: { role },
  });
  await writeAuditLog({
    actorUserId: actorUserId,
    action: AuditAction.DEV_MEMBER_CHANGED,
    targetType: "DeveloperProfile",
    targetId: profile.id,
    metadata: { targetUserId, role },
  });
  return { ok: true as const };
}

export async function createDeveloperApplication(
  userId: string,
  input: CreateDeveloperAppInput,
  ipAddress?: string | null,
) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) throw new DeveloperError("Create a developer profile first.", "INVALID");
  const member = await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "DEVELOPER"]);
  const scopes = assertScopes(input.scopes, input.scopes);
  if (input.environment === "PRODUCTION") {
    throw new DeveloperError(
      "Production apps require staff approval. Create a sandbox app first.",
      "FORBIDDEN",
    );
  }
  void member;
  const app = await prisma.developerApplication.create({
    data: {
      publicRef: generateDevAppRef(),
      profileId: mine.profileId,
      name: input.name,
      description: input.description,
      environment: "SANDBOX",
      scopes,
      redirectUris: input.redirectUris,
      logoUrl: input.logoUrl ?? null,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_APP_CREATED,
    targetType: "DeveloperApplication",
    targetId: app.id,
    metadata: { publicRef: app.publicRef, oauth: "deferred" },
    ipAddress: ipAddress ?? null,
  });
  return {
    publicRef: app.publicRef,
    name: app.name,
    environment: app.environment,
    status: app.status,
    scopes: app.scopes,
    redirectUris: app.redirectUris,
    oauth: "deferred" as const,
  };
}

export async function getDeveloperApplication(userId: string, publicRef: string) {
  const app = await prisma.developerApplication.findUnique({
    where: { publicRef },
    include: {
      apiKeys: {
        select: { prefix: true, name: true, scopes: true, revokedAt: true, lastUsedAt: true },
      },
    },
  });
  if (!app) throw new DeveloperError("Application not found.", "NOT_FOUND");
  await requireRole(userId, app.profileId, ["OWNER", "ADMIN", "DEVELOPER", "SUPPORT", "ANALYST"]);
  return {
    publicRef: app.publicRef,
    name: app.name,
    description: app.description,
    environment: app.environment,
    status: app.status,
    scopes: app.scopes,
    redirectUris: app.redirectUris,
    productionApprovedAt: app.productionApprovedAt?.toISOString() ?? null,
    oauth: "deferred" as const,
    keys: app.apiKeys.map((key) => ({
      prefix: key.prefix,
      name: key.name,
      scopes: key.scopes,
      revoked: Boolean(key.revokedAt),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      secret: null,
    })),
  };
}

export async function listDeveloperApplications(userId: string) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) return [];
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN", "DEVELOPER", "SUPPORT", "ANALYST"]);
  const apps = await prisma.developerApplication.findMany({
    where: { profileId: mine.profileId },
    orderBy: { createdAt: "desc" },
  });
  return apps.map((app) => ({
    publicRef: app.publicRef,
    name: app.name,
    environment: app.environment,
    status: app.status,
    scopes: app.scopes,
    redirectUris: app.redirectUris,
    oauth: "deferred" as const,
  }));
}

export async function createDeveloperApiKey(
  userId: string,
  input: CreateApiKeyInput,
  ipAddress?: string | null,
) {
  const app = await prisma.developerApplication.findUnique({
    where: { publicRef: input.applicationRef },
    include: { profile: true },
  });
  if (!app) throw new DeveloperError("Application not found.", "NOT_FOUND");
  const member = await requireRole(userId, app.profileId, ["OWNER", "ADMIN"]);
  if (!canManageSecrets(member.role)) {
    throw new DeveloperError("This role cannot manage API secrets.", "FORBIDDEN");
  }
  if (app.status !== "ACTIVE" || app.profile.suspendedAt) {
    throw new DeveloperError("Application is not active.", "FORBIDDEN");
  }
  if (app.environment === "PRODUCTION" && !app.productionApprovedAt) {
    throw new DeveloperError("Production keys require staff approval.", "FORBIDDEN");
  }
  const scopes = assertScopes(input.scopes, app.scopes);
  const generated = generateApiKey(app.environment);
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  await prisma.developerApiKey.create({
    data: {
      applicationId: app.id,
      userId,
      name: input.name,
      prefix: generated.prefix,
      secretHash: generated.secretHash,
      scopes,
      environment: app.environment,
      expiresAt,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_KEY_CREATED,
    targetType: "DeveloperApiKey",
    targetId: app.id,
    metadata: { prefix: generated.prefix },
    ipAddress: ipAddress ?? null,
  });
  return {
    prefix: generated.prefix,
    secret: generated.full,
    name: input.name,
    scopes,
    environment: app.environment,
    revealedOnce: true as const,
  };
}

export async function listDeveloperApiKeys(userId: string) {
  const mine = await getMyDeveloperProfile(userId);
  if (!mine) return [];
  await requireRole(userId, mine.profileId, ["OWNER", "ADMIN"]);
  const keys = await prisma.developerApiKey.findMany({
    where: { application: { profileId: mine.profileId } },
    orderBy: { createdAt: "desc" },
    select: {
      prefix: true,
      name: true,
      scopes: true,
      environment: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return keys.map((key) => ({
    ...key,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    secret: null,
  }));
}

export async function revokeDeveloperApiKey(userId: string, prefix: string) {
  const key = await prisma.developerApiKey.findUnique({
    where: { prefix },
    include: { application: true },
  });
  if (!key) throw new DeveloperError("API key not found.", "NOT_FOUND");
  await requireRole(userId, key.application.profileId, ["OWNER", "ADMIN"]);
  await prisma.developerApiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_KEY_REVOKED,
    targetType: "DeveloperApiKey",
    targetId: key.id,
    metadata: { prefix },
  });
  return { ok: true as const };
}

export async function rotateDeveloperApiKey(userId: string, prefix: string) {
  const key = await prisma.developerApiKey.findUnique({
    where: { prefix },
    include: { application: true },
  });
  if (!key || key.revokedAt) throw new DeveloperError("API key not found.", "NOT_FOUND");
  await requireRole(userId, key.application.profileId, ["OWNER", "ADMIN"]);
  const generated = generateApiKey(key.environment);
  await prisma.$transaction([
    prisma.developerApiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } }),
    prisma.developerApiKey.create({
      data: {
        applicationId: key.applicationId,
        userId,
        name: key.name,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
        scopes: key.scopes,
        environment: key.environment,
        expiresAt: key.expiresAt,
        rateLimitRpm: key.rateLimitRpm,
      },
    }),
  ]);
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.DEV_KEY_ROTATED,
    targetType: "DeveloperApiKey",
    targetId: key.id,
    metadata: { oldPrefix: prefix, prefix: generated.prefix },
  });
  return { prefix: generated.prefix, secret: generated.full, revealedOnce: true as const };
}

export async function authenticateApiKey(fullKey: string) {
  const parsed = parseApiKey(fullKey);
  if (!parsed) throw new DeveloperError("Invalid API key.", "FORBIDDEN");
  const row = await prisma.developerApiKey.findUnique({
    where: { prefix: parsed.prefix },
    include: { application: { include: { profile: true } } },
  });
  if (!row || row.revokedAt) throw new DeveloperError("Invalid API key.", "FORBIDDEN");
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw new DeveloperError("API key expired.", "FORBIDDEN");
  }
  if (!hashesEqual(row.secretHash, hashApiKeySecret(fullKey))) {
    throw new DeveloperError("Invalid API key.", "FORBIDDEN");
  }
  if (row.application.status !== "ACTIVE" || row.application.profile.suspendedAt) {
    throw new DeveloperError("Application is suspended.", "FORBIDDEN");
  }
  await prisma.developerApiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return row;
}
