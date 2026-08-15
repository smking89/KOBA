import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { createAidenJobSchema } from "@/features/aiden/schemas/aiden.schemas";
import { createJob, listJobs } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  try {
    return jsonAiden({ items: await listJobs(session.user.id) });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden jobs.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`aiden-job:${session.user.id}`, 12, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonAiden({ error: "Too many generation attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonAiden({ error: "Invalid JSON body." }, 400);
  }
  const parsed = createAidenJobSchema.safeParse(body);
  if (!parsed.success) {
    return jsonAiden({ error: "Invalid job details." }, 400);
  }
  try {
    const job = await createJob(session.user.id, parsed.data, clientIp(request));
    return jsonAiden(job, 201);
  } catch (error) {
    return jsonAidenError(error, "Could not create Aiden job.");
  }
}
