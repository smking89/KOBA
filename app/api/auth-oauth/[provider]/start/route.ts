import { NextResponse } from "next/server";
import { isLoginOAuthConfigured, isValidLoginOAuthProvider } from "@/features/auth-oauth/lib/providers";
import { buildLoginAuthorizeUrl } from "@/features/auth-oauth/lib/oauth";
import { LOGIN_OAUTH_PROVIDERS } from "@/features/auth-oauth/lib/providers";
import { signLoginOAuthState } from "@/features/auth-oauth/lib/state";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Starts "Continue with Discord/Google" — `?callbackUrl=` (default
 * `/dashboard`) is where the user lands after a successful sign-in. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase();
  if (!isValidLoginOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const popup = searchParams.get("popup") === "1";
  const errorPath = popup ? "/login/oauth-complete" : "/login";

  if (!isLoginOAuthConfigured(provider)) {
    const url = new URL(errorPath, APP_URL);
    url.searchParams.set("oauthError", "not_configured");
    url.searchParams.set("provider", provider.toLowerCase());
    return NextResponse.redirect(url);
  }

  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/dashboard");

  const state = await signLoginOAuthState({ provider, callbackUrl, popup });
  return NextResponse.redirect(buildLoginAuthorizeUrl(LOGIN_OAUTH_PROVIDERS[provider], state));
}
