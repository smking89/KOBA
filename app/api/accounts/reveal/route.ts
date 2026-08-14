import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markKobaIdRevealedSchema } from "@/features/accounts/schemas/account.schemas";
import { markKobaIdRevealed } from "@/features/accounts/services/account.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = markKobaIdRevealedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acknowledgement required." }, { status: 400 });
  }

  const snapshot = await markKobaIdRevealed(session.user.id);
  return NextResponse.json({ ok: true, snapshot });
}
