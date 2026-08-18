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

function loginError(code: string, provider: string) {
  const url = new URL("/login", APP_URL);
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

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return loginError("denied", provider.toLowerCase());
  if (!code || !state) return loginError("missing_params", provider.toLowerCase());

  const parsedState = await verifyLoginOAuthState(state);
  if (!parsedState || parsedState.provider !== provider) {
    return loginError("invalid_state", provider.toLowerCase());
  }

  const token = await exchangeLoginCode(config, code);
  if (!token) return loginError("token_exchange_failed", provider.toLowerCase());

  const providerUser = await fetchLoginProviderUser(config, token.access_token);
  if (!providerUser) return loginError("fetch_user_failed", provider.toLowerCase());

  try {
    const userId = await findOrCreateUserForOAuthLogin({
      provider: provider as LoginOAuthProvider,
      providerUserId: providerUser.id,
      email: providerUser.email,
      displayName: providerUser.username,
    });
    const ticket = await issueLoginTicket(userId);
    // Land back on /login itself — its client-side effect exchanges the
    // ticket for a real session, then forwards to the original
    // callbackUrl. Keeps ticket-consumption in one place instead of
    // needing every possible callbackUrl destination to know about it.
    const url = new URL("/login", APP_URL);
    url.searchParams.set("oauthTicket", ticket);
    url.searchParams.set("callbackUrl", safeInternalPath(parsedState.callbackUrl, "/dashboard"));
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof OAuthLoginError) {
      return loginError("email_exists", provider.toLowerCase());
    }
    return loginError("failed", provider.toLowerCase());
  }
}
