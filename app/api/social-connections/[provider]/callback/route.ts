import { NextResponse } from "next/server";
import {
  exchangeCode,
  fetchProviderUser,
  verifyConnectionState,
} from "@/features/social-connections/lib/oauth";
import { isValidSocialProvider, SOCIAL_PROVIDERS } from "@/features/social-connections/lib/providers";
import {
  connectShopSocial,
  connectUserSocial,
} from "@/features/social-connections/services/social-connection.service";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectTo(destination: string, status: "connected" | "error", detail?: string) {
  const url = new URL(destination, APP_URL);
  url.searchParams.set("social", status);
  if (detail) url.searchParams.set("socialDetail", detail);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase();
  if (!isValidSocialProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }
  const config = SOCIAL_PROVIDERS[provider];

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectTo("/settings", "error", "denied");
  if (!code || !state) return redirectTo("/settings", "error", "missing_params");

  const parsedState = await verifyConnectionState(state);
  if (!parsedState) return redirectTo("/settings", "error", "invalid_state");

  const destination = parsedState.type === "shop" ? "/seller/shop" : "/settings";

  const token = await exchangeCode(config, code, parsedState.codeVerifier);
  if (!token) return redirectTo(destination, "error", "token_exchange_failed");

  const providerUser = await fetchProviderUser(config, token.access_token);
  if (!providerUser) return redirectTo(destination, "error", "fetch_user_failed");

  try {
    if (parsedState.type === "shop") {
      await connectShopSocial(parsedState.shopId, parsedState.userId, provider, providerUser);
    } else {
      await connectUserSocial(parsedState.userId, provider, providerUser);
    }
  } catch (err) {
    return redirectTo(destination, "error", err instanceof Error ? err.message : "link_failed");
  }

  return redirectTo(destination, "connected");
}
