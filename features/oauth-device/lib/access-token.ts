import { prisma } from "@/lib/db";
import { hashAccessToken } from "@/features/oauth-device/lib/tokens";
import type { OAuthDeviceScope } from "@/features/oauth-device/lib/clients";

export type ResolvedAccessToken = {
  userId: string;
  clientKey: string;
  scopes: OAuthDeviceScope[];
};

/** The non-browser equivalent of `auth()` — resolves a device-flow
 * bearer token from the `Authorization` header instead of a session
 * cookie. Used by every /api/plugin/* route. */
export async function resolveAccessToken(request: Request): Promise<ResolvedAccessToken | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  if (!raw) return null;

  const token = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: hashAccessToken(raw) },
  });
  if (!token || token.revokedAt || token.expiresAt.getTime() <= Date.now()) return null;

  return {
    userId: token.userId,
    clientKey: token.clientKey,
    scopes: token.scopes as OAuthDeviceScope[],
  };
}

export function hasScope(resolved: ResolvedAccessToken, scope: OAuthDeviceScope): boolean {
  return resolved.scopes.includes(scope);
}
