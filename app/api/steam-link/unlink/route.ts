import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SteamLinkError, unlinkSteamAccount } from "@/features/steam-link/services/steam-link.service";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await unlinkSteamAccount(session.user.id);
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    if (error instanceof SteamLinkError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not unlink." }, { status: 500 });
  }
}
