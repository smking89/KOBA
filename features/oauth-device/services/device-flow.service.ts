import { AuditAction, type OAuthDeviceGrantStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  OAUTH_DEVICE_CLIENTS,
  isValidDeviceClientKey,
  isValidScope,
  type OAuthDeviceClientKey,
  type OAuthDeviceScope,
} from "@/features/oauth-device/lib/clients";
import { hashDeviceCode, newAccessToken, newDeviceCode, newUserCode } from "@/features/oauth-device/lib/tokens";

export class DeviceFlowError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_CLIENT" | "INVALID_SCOPE" | "NOT_FOUND" | "EXPIRED" | "ALREADY_RESOLVED",
  ) {
    super(message);
    this.name = "DeviceFlowError";
  }
}

const GRANT_TTL_MS = 10 * 60 * 1000; // RFC 8628 typical
const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days, revocable
const MIN_POLL_INTERVAL_MS = 4000; // just under the advertised 5s interval

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function createDeviceGrant(clientKey: string, requestedScopes: string[]) {
  if (!isValidDeviceClientKey(clientKey)) {
    throw new DeviceFlowError("Unknown client.", "INVALID_CLIENT");
  }
  const client = OAUTH_DEVICE_CLIENTS[clientKey];

  let scopes: OAuthDeviceScope[] = client.defaultScopes;
  if (requestedScopes.length > 0) {
    if (!requestedScopes.every(isValidScope)) {
      throw new DeviceFlowError("Unknown scope requested.", "INVALID_SCOPE");
    }
    scopes = requestedScopes as OAuthDeviceScope[];
  }

  const device = newDeviceCode();
  let userCode = newUserCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clash = await prisma.oAuthDeviceGrant.findUnique({ where: { userCode } });
    if (!clash) break;
    userCode = newUserCode();
  }

  const grant = await prisma.oAuthDeviceGrant.create({
    data: {
      deviceCodeHash: device.hash,
      userCode,
      clientKey: client.key,
      scopes,
      expiresAt: new Date(Date.now() + GRANT_TTL_MS),
    },
  });

  return {
    deviceCode: device.raw,
    userCode: grant.userCode,
    verificationUri: `${appUrl()}/oauth/authorize`,
    verificationUriComplete: `${appUrl()}/oauth/authorize?user_code=${encodeURIComponent(grant.userCode)}`,
    expiresIn: Math.floor(GRANT_TTL_MS / 1000),
    interval: grant.pollIntervalSeconds,
  };
}

export async function findGrantByUserCode(userCode: string) {
  const grant = await prisma.oAuthDeviceGrant.findUnique({ where: { userCode } });
  if (!grant) throw new DeviceFlowError("That code wasn't found or has expired.", "NOT_FOUND");
  if (grant.expiresAt.getTime() <= Date.now() || grant.status !== "PENDING") {
    throw new DeviceFlowError("That code wasn't found or has expired.", "NOT_FOUND");
  }
  const client = OAUTH_DEVICE_CLIENTS[grant.clientKey as OAuthDeviceClientKey] as
    | (typeof OAUTH_DEVICE_CLIENTS)[OAuthDeviceClientKey]
    | undefined;
  return { grant, clientLabel: client?.label ?? grant.clientKey };
}

async function resolveGrant(userCode: string, userId: string, status: "APPROVED" | "DENIED") {
  const grant = await prisma.oAuthDeviceGrant.findUnique({ where: { userCode } });
  if (!grant) throw new DeviceFlowError("That code wasn't found or has expired.", "NOT_FOUND");
  if (grant.expiresAt.getTime() <= Date.now()) {
    throw new DeviceFlowError("That code has expired.", "EXPIRED");
  }
  if (grant.status !== "PENDING") {
    throw new DeviceFlowError("That code was already used.", "ALREADY_RESOLVED");
  }

  await prisma.oAuthDeviceGrant.update({
    where: { id: grant.id },
    data: {
      status,
      userId,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
  });
}

export async function approveDeviceGrant(userCode: string, userId: string) {
  await resolveGrant(userCode, userId, "APPROVED");
}

export async function denyDeviceGrant(userCode: string, userId: string) {
  await resolveGrant(userCode, userId, "DENIED");
}

export type DeviceTokenResult =
  | { ok: true; accessToken: string; expiresIn: number; scope: string; tokenType: "Bearer" }
  | { ok: false; error: "authorization_pending" | "slow_down" | "access_denied" | "expired_token" | "invalid_grant" };

/** RFC 8628 §3.5 token-endpoint semantics — the client polls this on
 * `interval`; every state but a fresh APPROVED returns a specific
 * error code the client already knows how to interpret. */
export async function pollDeviceToken(deviceCode: string, clientKey: string): Promise<DeviceTokenResult> {
  const grant = await prisma.oAuthDeviceGrant.findUnique({
    where: { deviceCodeHash: hashDeviceCode(deviceCode) },
  });
  if (!grant || grant.clientKey !== clientKey) {
    return { ok: false, error: "invalid_grant" };
  }

  if (grant.expiresAt.getTime() <= Date.now()) {
    if (grant.status === "PENDING") {
      await prisma.oAuthDeviceGrant.update({ where: { id: grant.id }, data: { status: "EXPIRED" } });
    }
    return { ok: false, error: "expired_token" };
  }

  if (grant.status === "DENIED") {
    return { ok: false, error: "access_denied" };
  }

  if (grant.status === "PENDING") {
    if (grant.lastPolledAt && Date.now() - grant.lastPolledAt.getTime() < MIN_POLL_INTERVAL_MS) {
      return { ok: false, error: "slow_down" };
    }
    await prisma.oAuthDeviceGrant.update({ where: { id: grant.id }, data: { lastPolledAt: new Date() } });
    return { ok: false, error: "authorization_pending" };
  }

  // APPROVED — single-use: issue the access token, then delete the grant.
  if (!grant.userId) {
    return { ok: false, error: "invalid_grant" };
  }
  const token = newAccessToken();
  await prisma.$transaction([
    prisma.oAuthAccessToken.create({
      data: {
        tokenHash: token.hash,
        userId: grant.userId,
        clientKey: grant.clientKey,
        scopes: grant.scopes,
        expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
      },
    }),
    prisma.oAuthDeviceGrant.delete({ where: { id: grant.id } }),
  ]);

  await writeAuditLog({
    actorUserId: grant.userId,
    action: AuditAction.OAUTH_ACCESS_TOKEN_ISSUED,
    targetType: "User",
    targetId: grant.userId,
    metadata: { clientKey: grant.clientKey, scopes: grant.scopes },
  });

  return {
    ok: true,
    accessToken: token.raw,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: grant.scopes.join(" "),
    tokenType: "Bearer",
  };
}

export async function revokeAccessToken(userId: string, tokenId: string) {
  const token = await prisma.oAuthAccessToken.findFirst({ where: { id: tokenId, userId } });
  if (!token) throw new DeviceFlowError("Token not found.", "NOT_FOUND");
  await prisma.oAuthAccessToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
  await writeAuditLog({
    actorUserId: userId,
    action: AuditAction.OAUTH_ACCESS_TOKEN_REVOKED,
    targetType: "User",
    targetId: userId,
    metadata: { clientKey: token.clientKey },
  });
}

export async function listAccessTokens(userId: string) {
  return prisma.oAuthAccessToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export type { OAuthDeviceGrantStatus };
