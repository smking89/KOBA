import { SignJWT, jwtVerify } from "jose";
import { resolveAuthSecret } from "@/lib/auth/secret";

/**
 * "Connect Discord" on the developer profile — standard OAuth2
 * authorization-code flow (identify scope only), proving the publisher
 * controls a real Discord account. This is NOT yet full bot-ownership
 * verification: it ties a Discord user ID to a KOBAID, but doesn't
 * prove that Discord user owns any *specific* bot's application ID
 * (`DevProduct.discordClientId`) — Discord has no simple public API for
 * "does user U own application A" the way domain/DNS ownership can be
 * checked. The real path there (documented, not built yet): once
 * connected, ask the developer to temporarily paste a KOBA-generated
 * code into their bot's Description field in the Discord Developer
 * Portal, then confirm it via discord-invite.ts's public RPC lookup —
 * the same "prove you can edit settings only the owner can reach"
 * pattern used for domain/site ownership checks elsewhere. Flagging
 * this gap rather than faking a checkmark.
 *
 * Optional/fail-soft (same convention as Stripe/Aiden in lib/env.ts):
 * the connect flow simply stays disabled until DISCORD_CLIENT_ID +
 * DISCORD_CLIENT_SECRET are both set.
 */

const DISCORD_API = "https://discord.com/api/v10";

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function isDiscordOAuthConfigured(): boolean {
  return !isPlaceholder(process.env.DISCORD_CLIENT_ID) && !isPlaceholder(process.env.DISCORD_CLIENT_SECRET);
}

function redirectUri(): string {
  return (
    process.env.DISCORD_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/developers/discord/callback`
  );
}

/** Short-lived signed state token (5 min) — carries the initiating
 * user's id through the Discord redirect round-trip so the callback
 * can't be replayed for a different KOBA session, without needing a
 * server-side state table. Reuses the app's existing AUTH_SECRET rather
 * than inventing a second signing key. */
export async function signDiscordState(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(resolveAuthSecret());
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

export async function verifyDiscordState(state: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(resolveAuthSecret());
    const { payload } = await jwtVerify(state, secret);
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export function discordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

type DiscordTokenResponse = { access_token: string; token_type: string };
type DiscordUser = { id: string; username: string; global_name?: string | null };

export async function exchangeDiscordCode(code: string): Promise<DiscordTokenResponse | null> {
  if (!isDiscordOAuthConfigured()) return null;
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  return (await response.json()) as DiscordTokenResponse;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser | null> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as DiscordUser;
}
