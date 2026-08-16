import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { plusPortalSchema } from "@/features/plus/schemas/plus.schemas";
import { createBillingPortal } from "@/features/plus/services/plus.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`plus-portal:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonPlus({ error: "Too many billing portal attempts." }, 429);
  }
  if (request.headers.get("content-length") && request.headers.get("content-length") !== "0") {
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      return jsonPlus({ error: "Invalid JSON body." }, 400);
    }
    if (!plusPortalSchema.safeParse(body).success) {
      return jsonPlus({ error: "Invalid portal request." }, 400);
    }
  }
  try {
    return jsonPlus(await createBillingPortal(session.user.id));
  } catch (error) {
    return jsonPlusError(error, "Could not open billing portal.");
  }
}
