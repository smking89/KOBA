/**
 * Steam login — OpenID 2.0, not OAuth2, and keyless (no client
 * id/secret; Steam issues no app registration for "Sign in with
 * Steam," unlike Discord/Google). `STEAM_API_KEY` is optional and only
 * used afterward to look up a display name for handle seeding — a
 * missing key just falls back to a generic "SteamUser_<id>" handle
 * seed, same fail-soft convention as the rest of this codebase.
 *
 * Flow: redirect to Steam's login page with our return_to URL → Steam
 * redirects back with a signed `openid.*` assertion → we re-post those
 * exact params back to Steam with `openid.mode=check_authentication` to
 * confirm Steam itself signed them (this round-trip IS the security
 * check; nothing here trusts the browser's redirect on its own).
 */
const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const CLAIMED_ID_PREFIX = "https://steamcommunity.com/openid/id/";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** `returnPath` lets other Steam OpenID flows (e.g. features/steam-link,
 * "add a Steam account to my already-logged-in profile" — a different
 * flow from login, which creates a session) reuse this same OpenID
 * plumbing with their own callback route. Defaults to the login
 * callback so existing call sites don't need to change. */
export function steamRedirectUri(returnPath = "/api/auth-oauth/steam/callback"): string {
  return `${appUrl()}${returnPath}`;
}

export function buildSteamAuthorizeUrl(state: string, returnPath?: string): string {
  const returnTo = new URL(steamRedirectUri(returnPath));
  returnTo.searchParams.set("state", state);
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo.toString(),
    "openid.realm": appUrl(),
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

/** Verifies a Steam OpenID callback and returns the steamid64, or null
 * if the assertion doesn't check out. */
export async function verifySteamCallback(searchParams: URLSearchParams): Promise<string | null> {
  const claimedId = searchParams.get("openid.claimed_id");
  if (!claimedId?.startsWith(CLAIMED_ID_PREFIX)) return null;
  const steamId = claimedId.slice(CLAIMED_ID_PREFIX.length);
  if (!/^\d{17}$/.test(steamId)) return null;

  const verifyParams = new URLSearchParams(searchParams);
  verifyParams.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  if (!response.ok) return null;
  const body = await response.text();
  if (!/is_valid\s*:\s*true/.test(body)) return null;

  return steamId;
}

/** Best-effort display name for handle seeding — never blocks login. */
export async function fetchSteamPersonaName(steamId: string): Promise<string | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      response?: { players?: Array<{ personaname?: string }> };
    };
    const name = json.response?.players?.[0]?.personaname;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}
