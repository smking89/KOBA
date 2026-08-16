import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { clearStaffMfaCookies } from "@/features/staff-mfa/lib/cookies";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { disableMfaSchema } from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { disableStaffMfa } from "@/features/staff-mfa/services/staff-mfa.service";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  const limited = await rateLimit(`mfa-disable:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = disableMfaSchema.safeParse(body);
  if (!parsed.success) return jsonStaffMfa({ error: "Invalid request." }, 400);

  try {
    await disableStaffMfa({
      userId: session.user.id,
      password: parsed.data.password,
      code: parsed.data.code,
      ip: clientIp(request),
    });
    const response = jsonStaffMfa({ ok: true });
    clearStaffMfaCookies(response);
    return response;
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}
