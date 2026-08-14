import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { listLibrary } from "@/features/aiden/services/aiden.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ items: await listLibrary(session.user.id) });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden library.");
  }
}
