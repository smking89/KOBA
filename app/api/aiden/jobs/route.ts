import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { assertAidenBusinessAccess } from "@/features/aiden/lib/require-business";
import { createAidenJobSchema } from "@/features/aiden/schemas/aiden.schemas";
import { createJob, listJobs } from "@/features/aiden/services/aiden.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await assertAidenBusinessAccess(session.user.id);
    return NextResponse.json({ items: await listJobs(session.user.id) });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden jobs.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`aiden-job:${session.user.id}`, 12, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many generation attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createAidenJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job details." }, { status: 400 });
  }
  try {
    await assertAidenBusinessAccess(session.user.id);
    const job = await createJob(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return jsonAidenError(error, "Could not create Aiden job.");
  }
}
