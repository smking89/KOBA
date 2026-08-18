import { NextResponse } from "next/server";
import type { LoginOAuthProvider } from "@/lib/generated/prisma/client";
import { isValidLoginOAuthProvider, LOGIN_OAUTH_PROVIDERS } from "@/features/auth-oauth/lib/providers";
import { exchangeLoginCode, fetchLoginProviderUser } from "@/features/auth-oauth/lib/oauth";
import { verifyLoginOAuthState } from "@/features/auth-oauth/lib/state";
import { issueLoginTicket } from "@/features/auth-oauth/lib/login-ticket";
import {
  findOrCreateUserForOAuthLogin,
  OAuthLoginError,
} from "@/features/auth-oauth/services/oauth-login.service";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function errorRedirect(code: string, provider: string, popup: boolean) {
  const url = new URL(popup ? "/login/oauth-complete" : "/login", APP_URL);
  url.searchParams.set("oauthError", code);
  url.searchParams.set("provider", provider);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase();
  if (!isValidLoginOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }
  const config = LOGIN_OAUTH_PROVIDERS[provider];
  const providerSlug = provider.toLowerCase();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Parsed before the code/error checks below so every error redirect —
  // not just the happy path — can tell whether it should close a popup
  // (postMessage) or navigate a full tab.
  const parsedState = state ? await verifyLoginOAuthState(state) : null;
  const popup = parsedState?.popup === true;

  if (oauthError) return errorRedirect("denied", providerSlug, popup);
  if (!code || !state) return errorRedirect("missing_params", providerSlug, popup);
  if (!parsedState || parsedState.provider !== provider) {
    return errorRedirect("invalid_state", providerSlug, popup);
  }

  const token = await exchangeLoginCode(config, code);
  if (!token) return errorRedirect("token_exchange_failed", providerSlug, popup);

  const providerUser = await fetchLoginProviderUser(config, token.access_token);
  if (!providerUser) return errorRedirect("fetch_user_failed", providerSlug, popup);

  try {
    const userId = await findOrCreateUserForOAuthLogin({
      provider: provider as LoginOAuthProvider,
      providerUserId: providerUser.id,
      email: providerUser.email,
      displayName: providerUser.username,
    });
    const ticket = await issueLoginTicket(userId);
    // Non-popup: land back on /login, whose client-side effect exchanges
    // the ticket and forwards to callbackUrl. Popup: land on the tiny
    // oauth-complete page, which postMessages the ticket to the opener
    // and closes itself — the opener (wherever OAuthLoginButtons is
    // rendered) does the actual session exchange.
    const url = new URL(popup ? "/login/oauth-complete" : "/login", APP_URL);
    url.searchParams.set("oauthTicket", ticket);
    if (!popup) {
      url.searchParams.set("callbackUrl", safeInternalPath(parsedState.callbackUrl, "/dashboard"));
    }
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof OAuthLoginError) {
      return errorRedirect("email_exists", providerSlug, popup);
    }
    return errorRedirect("failed", providerSlug, popup);
  }
}
