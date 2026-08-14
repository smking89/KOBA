import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonMessageError } from "@/features/messages/lib/http";
import { sendMessageSchema } from "@/features/messages/schemas/message.schemas";
import { getThread, sendMessage } from "@/features/messages/services/message.service";

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await getThread(session.user.id, ref));
  } catch (error) {
    return jsonMessageError(error, "Could not load conversation.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`dm:${session.user.id}`, 60, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many messages." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    const message = await sendMessage(session.user.id, ref, parsed.data, clientIp(request));
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return jsonMessageError(error, "Could not send message.");
  }
}
