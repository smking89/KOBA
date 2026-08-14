import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonMessageError } from "@/features/messages/lib/http";
import { reportConversationSchema } from "@/features/messages/schemas/message.schemas";
import { reportConversation } from "@/features/messages/services/message.service";

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
  const parsed = reportConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await reportConversation(session.user.id, ref, parsed.data), {
      status: 201,
    });
  } catch (error) {
    return jsonMessageError(error, "Could not file report.");
  }
}
