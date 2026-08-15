import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { plusCancelSchema } from "@/features/plus/schemas/plus.schemas";
import { cancelAtPeriodEnd } from "@/features/plus/services/plus.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`plus-cancel:${session.user.id}`, 8, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonPlus({ error: "Too many cancellation attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPlus({ error: "Invalid JSON body." }, 400);
  }
  const parsed = plusCancelSchema.safeParse(body);
  if (!parsed.success) {
    return jsonPlus({ error: "Invalid cancellation request." }, 400);
  }
  try {
    const subscription = await cancelAtPeriodEnd(
      session.user.id,
      parsed.data.idempotencyKey,
      clientIp(request),
    );
    return jsonPlus({ subscription });
  } catch (error) {
    return jsonPlusError(error, "Could not cancel Plus.");
  }
}
