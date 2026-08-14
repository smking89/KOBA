import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonMessageError } from "@/features/messages/lib/http";
import { setVanishMode } from "@/features/messages/services/message.service";
import { z } from "zod";

const schema = z.object({ vanishMode: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await setVanishMode(session.user.id, ref, parsed.data.vanishMode));
  } catch (error) {
    return jsonMessageError(error, "Could not update vanish mode.");
  }
}
