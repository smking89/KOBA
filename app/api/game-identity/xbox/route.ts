import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linkXboxSchema } from "@/features/game-identity/schemas/game-identity.schemas";
import {
  GameIdentityError,
  linkXboxGamertag,
  unlinkXboxGamertag,
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
  const parsed = linkXboxSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid gamertag." }, { status: 400 });

  try {
    const link = await linkXboxGamertag(session.user.id, parsed.data.gamertag);
    return NextResponse.json({ link });
  } catch (error) {
    if (error instanceof GameIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not link Xbox gamertag." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await unlinkXboxGamertag(session.user.id);
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    if (error instanceof GameIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not unlink." }, { status: 500 });
  }
}
