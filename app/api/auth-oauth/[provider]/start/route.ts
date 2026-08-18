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
  if (!isLoginOAuthConfigured(provider)) {
    return NextResponse.redirect(
      new URL(`/login?oauthError=not_configured&provider=${provider.toLowerCase()}`, APP_URL),
    );
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/dashboard");

  const state = await signLoginOAuthState({ provider, callbackUrl });
  return NextResponse.redirect(buildLoginAuthorizeUrl(LOGIN_OAUTH_PROVIDERS[provider], state));
}
