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

function loginError(code: string) {
  const url = new URL("/login", APP_URL);
  url.searchParams.set("oauthError", code);
  url.searchParams.set("provider", "steam");
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const state = searchParams.get("state");
  if (!state) return loginError("missing_params");
  const parsedState = await verifyLoginOAuthState(state);
  if (!parsedState || parsedState.provider !== "STEAM") return loginError("invalid_state");

  const steamId = await verifySteamCallback(searchParams);
  if (!steamId) return loginError("token_exchange_failed");

  const personaName = await fetchSteamPersonaName(steamId);

  try {
    const userId = await findOrCreateUserForOAuthLogin({
      provider: "STEAM",
      providerUserId: steamId,
      email: null,
      displayName: personaName ?? `SteamUser${steamId.slice(-6)}`,
    });
    const ticket = await issueLoginTicket(userId);
    const url = new URL("/login", APP_URL);
    url.searchParams.set("oauthTicket", ticket);
    url.searchParams.set("callbackUrl", safeInternalPath(parsedState.callbackUrl, "/dashboard"));
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof OAuthLoginError) return loginError("email_exists");
    return loginError("failed");
  }
}
