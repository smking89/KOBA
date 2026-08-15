import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { assertAidenBusinessAccess } from "@/features/aiden/lib/require-business";
import { listLibrary } from "@/features/aiden/services/aiden.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await assertAidenBusinessAccess(session.user.id);
    return NextResponse.json({ items: await listLibrary(session.user.id) });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden library.");
  }
}
