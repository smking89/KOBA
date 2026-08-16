import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { stepUpSchema } from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { verifyStepUp } from "@/features/staff-mfa/services/staff-mfa.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  const limited = await rateLimit(`mfa-stepup:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = stepUpSchema.safeParse(body);
  if (!parsed.success) return jsonStaffMfa({ error: "Invalid authentication code." }, 400);

  try {
    const assurance = await assertStaffAal2(session.user.id);
    await verifyStepUp({
      userId: session.user.id,
      sessionId: assurance.elevation.session.id,
      code: parsed.data.code,
      ip: clientIp(request),
    });
    return jsonStaffMfa({ ok: true });
  } catch (error) {
    return jsonStaffMfaError(error, "Invalid authentication code.");
  }
}
