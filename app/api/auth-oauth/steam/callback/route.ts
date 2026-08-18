import { NextResponse } from "next/server";
import { fetchSteamPersonaName, verifySteamCallback } from "@/features/auth-oauth/lib/steam";
import { verifyLoginOAuthState } from "@/features/auth-oauth/lib/state";
import { issueLoginTicket } from "@/features/auth-oauth/lib/login-ticket";
import {
  findOrCreateUserForOAuthLogin,
  OAuthLoginError,
} from "@/features/auth-oauth/services/oauth-login.service";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function errorRedirect(code: string, popup: boolean) {
  const url = new URL(popup ? "/login/oauth-complete" : "/login", APP_URL);
  url.searchParams.set("oauthError", code);
  url.searchParams.set("provider", "steam");
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const state = searchParams.get("state");
  const parsedState = state ? await verifyLoginOAuthState(state) : null;
  const popup = parsedState?.popup === true;

  if (!state) return errorRedirect("missing_params", popup);
  if (!parsedState || parsedState.provider !== "STEAM") return errorRedirect("invalid_state", popup);

  const steamId = await verifySteamCallback(searchParams);
  if (!steamId) return errorRedirect("token_exchange_failed", popup);

  const personaName = await fetchSteamPersonaName(steamId);

  try {
    const userId = await findOrCreateUserForOAuthLogin({
      provider: "STEAM",
      providerUserId: steamId,
      email: null,
      displayName: personaName ?? `SteamUser${steamId.slice(-6)}`,
    });
    const ticket = await issueLoginTicket(userId);
    const url = new URL(popup ? "/login/oauth-complete" : "/login", APP_URL);
    url.searchParams.set("oauthTicket", ticket);
    if (!popup) {
      url.searchParams.set("callbackUrl", safeInternalPath(parsedState.callbackUrl, "/dashboard"));
    }
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof OAuthLoginError) return errorRedirect("email_exists", popup);
    return errorRedirect("failed", popup);
  }
}
