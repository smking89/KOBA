import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linkPlayStationSchema } from "@/features/game-identity/schemas/game-identity.schemas";
import {
  GameIdentityError,
  linkPlayStationUsername,
  unlinkPlayStationUsername,
} from "@/features/game-identity/services/game-identity.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = linkPlayStationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid PSN username." }, { status: 400 });

  try {
    const link = await linkPlayStationUsername(session.user.id, parsed.data.psnUsername);
    return NextResponse.json({ link });
  } catch (error) {
    if (error instanceof GameIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not link PSN username." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await unlinkPlayStationUsername(session.user.id);
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    if (error instanceof GameIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not unlink." }, { status: 500 });
  }
}
