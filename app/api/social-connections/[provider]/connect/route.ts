import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  generatePkcePair,
  signConnectionState,
} from "@/features/social-connections/lib/oauth";
import {
  isSocialProviderConfigured,
  isValidSocialProvider,
  SOCIAL_PROVIDERS,
} from "@/features/social-connections/lib/providers";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Starts a "Connect <provider>" flow for a user or shop bio.
 * `?owner=user` (default) or `?owner=shop&shopId=...`. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase();
  if (!isValidSocialProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.redirect(new URL("/login", APP_URL));
  }

  if (!isSocialProviderConfigured(provider)) {
    return NextResponse.redirect(new URL("/settings?socialError=not_configured", APP_URL));
  }

  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get("owner") === "shop" ? "shop" : "user";
  const shopId = searchParams.get("shopId");
  if (ownerType === "shop" && !shopId) {
    return NextResponse.json({ error: "shopId is required for shop connections." }, { status: 400 });
  }

  const config = SOCIAL_PROVIDERS[provider];
  const pkce = config.usesPkce ? generatePkcePair() : null;

  const state = await signConnectionState(
    ownerType === "shop"
      ? { type: "shop", shopId: shopId as string, userId: session.user.id, provider, codeVerifier: pkce?.verifier }
      : { type: "user", userId: session.user.id, provider, codeVerifier: pkce?.verifier },
  );

  return NextResponse.redirect(buildAuthorizeUrl(config, state, pkce?.challenge));
}
