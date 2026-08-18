import type { LoginOAuthConfig, LoginOAuthProviderKey } from "@/features/auth-oauth/lib/providers";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function loginRedirectUri(provider: LoginOAuthProviderKey): string {
  return `${appUrl()}/api/auth-oauth/${provider.toLowerCase()}/callback`;
}

export function buildLoginAuthorizeUrl(config: LoginOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] ?? "",
    redirect_uri: loginRedirectUri(config.key),
    response_type: "code",
    scope: config.scope,
    state,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeLoginCode(
  config: LoginOAuthConfig,
  code: string,
): Promise<{ access_token: string } | null> {
  const body = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] ?? "",
    client_secret: process.env[config.clientSecretEnv] ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: loginRedirectUri(config.key),
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  return (await response.json()) as { access_token: string };
}

export type LoginProviderUser = { id: string; username: string; email: string | null };

export async function fetchLoginProviderUser(
  config: LoginOAuthConfig,
  accessToken: string,
): Promise<LoginProviderUser | null> {
  const response = await fetch(config.userInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as Record<string, unknown>;
  return config.parseUser(json);
}
