import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { jsonMessageError } from "@/features/messages/lib/http";
import { startConversationSchema } from "@/features/messages/schemas/message.schemas";
import { listInbox, openConversation } from "@/features/messages/services/message.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ items: await listInbox(session.user.id) });
  } catch (error) {
    return jsonMessageError(error, "Could not load messages.");
  }
}

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
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid handle." }, { status: 400 });
  }
  try {
    const conversation = await openConversation(
      session.user.id,
      parsed.data.handle,
      clientIp(request),
    );
    return NextResponse.json(conversation, { status: conversation.created ? 201 : 200 });
  } catch (error) {
    return jsonMessageError(error, "Could not open conversation.");
  }
}
