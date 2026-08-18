import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildSteamAuthorizeUrl } from "@/features/auth-oauth/lib/steam";
import { signSteamLinkState } from "@/features/steam-link/lib/state";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** "Link Steam" from /settings — distinct from features/auth-oauth's
 * login-Steam flow, which has no session yet to attach to. */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/settings", APP_URL));
  }

  const state = await signSteamLinkState({ userId: session.user.id });
  return NextResponse.redirect(buildSteamAuthorizeUrl(state, "/api/steam-link/callback"));
}
