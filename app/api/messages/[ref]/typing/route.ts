import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonMessageError } from "@/features/messages/lib/http";
import { signalTyping } from "@/features/messages/services/message.service";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await signalTyping(session.user.id, ref));
  } catch (error) {
    return jsonMessageError(error, "Could not signal typing.");
  }
}
