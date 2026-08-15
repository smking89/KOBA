import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { assertAidenBusinessAccess } from "@/features/aiden/lib/require-business";
import { aidenJobActionSchema } from "@/features/aiden/schemas/aiden.schemas";
import { cancelJob } from "@/features/aiden/services/aiden.service";

export async function PATCH(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`aiden-cancel:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many cancel attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = aidenJobActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job action." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    await assertAidenBusinessAccess(session.user.id);
    if (parsed.data.action === "cancel") {
      const job = await cancelJob(session.user.id, ref, clientIp(request));
      return NextResponse.json(job);
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return jsonAidenError(error, "Could not update Aiden job.");
  }
}
