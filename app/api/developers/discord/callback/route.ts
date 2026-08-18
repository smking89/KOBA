import { NextResponse } from "next/server";
import {
  exchangeDiscordCode,
  fetchDiscordUser,
  verifyDiscordState,
} from "@/features/developers/lib/discord-oauth";
import { connectDiscordAccount } from "@/features/developers/services/portal.service";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectTo(status: "connected" | "error", detail?: string) {
  const url = new URL("/developers/dashboard", APP_URL);
  url.searchParams.set("discord", status);
  if (detail) url.searchParams.set("discordDetail", detail);
  return NextResponse.redirect(url);
}

/** Discord's OAuth redirect target — exchanges the authorization code,
 * fetches the connecting user's Discord identity, and links it to their
 * developer profile. The `state` param (signed, 5 min TTL) is what ties
 * this callback back to the KOBA user who started the flow — Discord's
 * own OAuth doesn't carry a KOBA session across the redirect. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectTo("error", "denied");
  if (!code || !state) return redirectTo("error", "missing_params");

  const userId = await verifyDiscordState(state);
  if (!userId) return redirectTo("error", "invalid_state");

  const token = await exchangeDiscordCode(code);
  if (!token) return redirectTo("error", "token_exchange_failed");

  const discordUser = await fetchDiscordUser(token.access_token);
  if (!discordUser) return redirectTo("error", "fetch_user_failed");

  try {
    await connectDiscordAccount(userId, discordUser.id, discordUser.username);
  } catch {
    return redirectTo("error", "link_failed");
  }

  return redirectTo("connected");
}
