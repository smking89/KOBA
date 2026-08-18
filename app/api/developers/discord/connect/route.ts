import { NextResponse } from "next/server";
import { discordAuthorizeUrl, isDiscordOAuthConfigured, signDiscordState } from "@/features/developers/lib/discord-oauth";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

/** Starts the "Connect Discord" flow — redirects to Discord's own OAuth
 * consent screen. See discord-oauth.ts's docblock for exactly what this
 * does and doesn't prove. */
export async function GET() {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;

  if (!isDiscordOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/developers/dashboard?discordError=not_configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  const state = await signDiscordState(session.userId);
  return NextResponse.redirect(discordAuthorizeUrl(state));
}
