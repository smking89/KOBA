import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { resolveAuthSecret } from "@/lib/auth/secret";
import type { SocialProviderConfig, SocialProviderKey } from "@/features/social-connections/lib/providers";

/** Where an OAuth connection attaches once it succeeds. Carried inside
 * the signed state token through the provider's redirect round-trip. */
export type ConnectionOwner =
  | { type: "user"; userId: string }
  | { type: "shop"; shopId: string; userId: string };

function redirectUri(provider: SocialProviderKey): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/social-connections/${provider.toLowerCase()}/callback`;
}

type OAuthState = ConnectionOwner & { provider: SocialProviderKey; codeVerifier?: string | undefined };

/** Short-lived (5 min) signed state — carries the owner (user, or shop +
 * acting user) and, for PKCE providers, the code verifier itself, through
 * the redirect round-trip. Reuses the app's existing AUTH_SECRET rather
 * than a new signing key or a server-side state table. */
export async function signConnectionState(state: OAuthState): Promise<string> {
  const secret = new TextEncoder().encode(resolveAuthSecret());
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

export async function verifyConnectionState(state: string): Promise<OAuthState | null> {
  try {
    const secret = new TextEncoder().encode(resolveAuthSecret());
    const { payload } = await jwtVerify(state, secret);
    if (payload.type === "user" && typeof payload.userId === "string") {
      return {
        type: "user",
        userId: payload.userId,
        provider: payload.provider as SocialProviderKey,
        codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : undefined,
      };
    }
    if (
      payload.type === "shop" &&
      typeof payload.shopId === "string" &&
      typeof payload.userId === "string"
    ) {
      return {
        type: "shop",
        shopId: payload.shopId,
        userId: payload.userId,
        provider: payload.provider as SocialProviderKey,
        codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE (RFC 7636) — required by Twitter's OAuth2, harmless to compute
 * and unused for providers that don't need it. */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  config: SocialProviderConfig,
  state: string,
  pkceChallenge?: string,
): string {
  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] ?? "",
    redirect_uri: redirectUri(config.key),
    response_type: "code",
    scope: config.scope,
    state,
  });
  if (config.usesPkce && pkceChallenge) {
    params.set("code_challenge", pkceChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(
  config: SocialProviderConfig,
  code: string,
  codeVerifier?: string,
): Promise<{ access_token: string; token_type: string } | null> {
  const body = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] ?? "",
    client_secret: process.env[config.clientSecretEnv] ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(config.key),
  });
  if (config.usesPkce && codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  return (await response.json()) as { access_token: string; token_type: string };
}

export type ProviderUser = { id: string; username: string; profileUrl: string | null };

export async function fetchProviderUser(
  config: SocialProviderConfig,
  accessToken: string,
): Promise<ProviderUser | null> {
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` };
  // Twitch's Helix API requires the app's client ID on every request, not
  // just the token exchange — the one real quirk among these four.
  if (config.key === "TWITCH") {
    headers["client-id"] = process.env[config.clientIdEnv] ?? "";
  }
  const response = await fetch(config.userInfoUrl, { headers });
  if (!response.ok) return null;
  const json = (await response.json()) as Record<string, unknown>;
  return config.parseUser(json);
}
