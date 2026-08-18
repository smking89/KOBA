import { NextResponse } from "next/server";
import { buildSteamAuthorizeUrl } from "@/features/auth-oauth/lib/steam";
import { signLoginOAuthState } from "@/features/auth-oauth/lib/state";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export const dynamic = "force-dynamic";

/** Steam needs no app credentials (OpenID 2.0, keyless) so unlike the
 * Discord/Google `[provider]/start` route this is never gated on
 * "configured" — the button always works. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/dashboard");

  const state = await signLoginOAuthState({ provider: "STEAM", callbackUrl });
  return NextResponse.redirect(buildSteamAuthorizeUrl(state));
}
