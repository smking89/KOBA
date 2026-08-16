import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { adminPlusReconcileSchema } from "@/features/plus/schemas/plus.schemas";
import { staffReconcilePlus } from "@/features/plus/services/plus-admin.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`plus-reconcile:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonPlus({ error: "Too many reconcile attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPlus({ error: "Invalid JSON body." }, 400);
  }
  const parsed = adminPlusReconcileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonPlus({ error: "Invalid reconcile request." }, 400);
  }
  try {
    return jsonPlus(await staffReconcilePlus(session.user.id, parsed.data.publicRef));
  } catch (error) {
    return jsonPlusError(error, "Could not reconcile Plus subscription.");
  }
}
