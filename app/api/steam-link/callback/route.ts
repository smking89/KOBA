import { NextResponse } from "next/server";
import { fetchSteamPersonaName, verifySteamCallback } from "@/features/auth-oauth/lib/steam";
import { verifySteamLinkState } from "@/features/steam-link/lib/state";
import { linkSteamAccount, SteamLinkError } from "@/features/steam-link/services/steam-link.service";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectWithError(code: string) {
  const url = new URL("/settings", APP_URL);
  url.searchParams.set("steamLinkError", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const state = searchParams.get("state");
  const parsedState = state ? await verifySteamLinkState(state) : null;
  if (!parsedState) return redirectWithError("invalid_state");

  const steamId = await verifySteamCallback(searchParams);
  if (!steamId) return redirectWithError("verification_failed");

  const personaName = await fetchSteamPersonaName(steamId);

  try {
    await linkSteamAccount(parsedState.userId, steamId, personaName);
  } catch (error) {
    if (error instanceof SteamLinkError) return redirectWithError("already_linked");
    return redirectWithError("failed");
  }

  const url = new URL("/settings", APP_URL);
  url.searchParams.set("steamLinked", "1");
  return NextResponse.redirect(url);
}
