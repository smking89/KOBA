import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { aidenJobActionSchema } from "@/features/aiden/schemas/aiden.schemas";
import { cancelJob, getJob } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const { ref } = await context.params;
  try {
    return jsonAiden(await getJob(session.user.id, ref));
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden job.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`aiden-cancel:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonAiden({ error: "Too many cancel attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonAiden({ error: "Invalid JSON body." }, 400);
  }
  const parsed = aidenJobActionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonAiden({ error: "Invalid job action." }, 400);
  }
  const { ref } = await context.params;
  try {
    if (parsed.data.action === "cancel") {
      const job = await cancelJob(session.user.id, ref, clientIp(request));
      return jsonAiden(job);
    }
    return jsonAiden({ error: "Unsupported action." }, 400);
  } catch (error) {
    return jsonAidenError(error, "Could not update Aiden job.");
  }
}
