import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { adminPlusGrantSchema } from "@/features/plus/schemas/plus.schemas";
import { issueCompensatoryGrant } from "@/features/plus/services/plus-admin.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`plus-grant:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonPlus({ error: "Too many grant attempts." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPlus({ error: "Invalid JSON body." }, 400);
  }
  const parsed = adminPlusGrantSchema.safeParse(body);
  if (!parsed.success) {
    return jsonPlus({ error: "Invalid grant request." }, 400);
  }
  try {
    const expiresAt = parsed.data.expiresAt ?? null;
    return jsonPlus(
      await issueCompensatoryGrant(session.user.id, {
        kobaIdentityId: parsed.data.kobaIdentityId,
        code: parsed.data.code,
        reason: parsed.data.reason,
        ...(expiresAt ? { expiresAt } : {}),
      }),
    );
  } catch (error) {
    return jsonPlusError(error, "Could not issue Plus grant.");
  }
}
