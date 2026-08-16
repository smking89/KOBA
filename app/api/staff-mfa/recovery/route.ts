import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { regenerateRecoverySchema } from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { regenerateRecoveryCodesForUser } from "@/features/staff-mfa/services/staff-mfa.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  const limited = await rateLimit(`mfa-recovery:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = regenerateRecoverySchema.safeParse(body);
  if (!parsed.success) return jsonStaffMfa({ error: "Invalid request." }, 400);

  try {
    await assertStaffAal2(session.user.id, { stepUp: true });
    const codes = await regenerateRecoveryCodesForUser({
      userId: session.user.id,
      password: parsed.data.password,
      code: parsed.data.code,
      ip: clientIp(request),
    });
    return jsonStaffMfa({ recoveryCodes: codes });
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}
