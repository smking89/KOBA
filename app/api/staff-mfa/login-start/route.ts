import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { applyPendingCookie } from "@/features/staff-mfa/lib/cookies";
import { loginStartSchema } from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { startStaffAwareLogin } from "@/features/staff-mfa/services/login-gate.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`mfa-login-start:${ip}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonStaffMfa({ error: "Invalid email or password." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = loginStartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonStaffMfa({ error: "Invalid email or password." }, 401);
  }
  try {
    const result = await startStaffAwareLogin({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: ip,
    });
    if (result.next === "mfa") {
      const response = jsonStaffMfa({ next: "mfa" });
      applyPendingCookie(response, result.rawToken);
      return response;
    }
    return jsonStaffMfa({ next: result.next });
  } catch (error) {
    return jsonStaffMfaError(error, "Invalid email or password.");
  }
}
