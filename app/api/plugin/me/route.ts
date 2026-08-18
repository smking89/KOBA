import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAccessToken } from "@/features/oauth-device/lib/access-token";
import { getSteamLink } from "@/features/steam-link/services/steam-link.service";

export const dynamic = "force-dynamic";

/** Identity check the plugin calls right after obtaining a token — who
 * it's connected as, and whether a Steam account is linked yet (the
 * plugin needs steamId64 to know which local Steam install to target). */
export async function GET(request: Request) {
  const resolved = await resolveAccessToken(request);
  if (!resolved) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [user, steamLink] = await Promise.all([
    prisma.user.findUnique({
      where: { id: resolved.userId },
      select: { id: true, name: true, profile: { select: { handle: true, displayName: true } } },
    }),
    getSteamLink(resolved.userId),
  ]);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    userId: user.id,
    handle: user.profile?.handle ?? null,
    displayName: user.profile?.displayName ?? user.name,
    steamId64: steamLink?.steamId64 ?? null,
    scopes: resolved.scopes,
  });
}
