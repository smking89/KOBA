import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { applyElevationCookie, clearStaffMfaCookies } from "@/features/staff-mfa/lib/cookies";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import {
  enrollConfirmSchema,
  enrollStartSchema,
} from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import {
  confirmEnrollment,
  startEnrollment,
} from "@/features/staff-mfa/services/staff-mfa.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  const limited = await rateLimit(`mfa-enroll:${session.user.id}`, 8, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = enrollStartSchema.safeParse(body);
  if (!parsed.success) return jsonStaffMfa({ error: "Invalid request." }, 400);

  try {
    const started = await startEnrollment({
      userId: session.user.id,
      password: parsed.data.password,
      ip: clientIp(request),
    });
    return jsonStaffMfa({
      otpauth: started.otpauth,
      secret: started.secret,
      qrDataUrl: started.qrDataUrl,
      expiresAt: started.expiresAt,
    });
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  const limited = await rateLimit(`mfa-enroll-confirm:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = enrollConfirmSchema.safeParse(body);
  if (!parsed.success) return jsonStaffMfa({ error: "Invalid authentication code." }, 400);

  try {
    const confirmed = await confirmEnrollment({
      userId: session.user.id,
      code: parsed.data.code,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    const response = jsonStaffMfa({ recoveryCodes: confirmed.recoveryCodes });
    clearStaffMfaCookies(response);
    applyElevationCookie(response, confirmed.session.rawToken, confirmed.session.expiresAt);
    return response;
  } catch (error) {
    return jsonStaffMfaError(error, "Invalid authentication code.");
  }
}
