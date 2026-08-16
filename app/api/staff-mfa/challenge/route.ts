import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { CHALLENGE_PURPOSE, STAFF_PENDING_COOKIE } from "@/features/staff-mfa/lib/config";
import {
  applyElevationCookie,
  applyPendingCookie,
  clearPendingCookie,
} from "@/features/staff-mfa/lib/cookies";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { challengeVerifySchema } from "@/features/staff-mfa/schemas/staff-mfa.schemas";
import { userHasActiveStaffMfa, userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import {
  createMfaChallenge,
  verifyMfaChallenge,
} from "@/features/staff-mfa/services/staff-mfa.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`mfa-challenge:${ip}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonStaffMfa({ error: "Too many attempts." }, 429);
  }

  const store = await cookies();
  const pending = store.get(STAFF_PENDING_COOKIE)?.value;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonStaffMfa({ error: "Invalid JSON body." }, 400);
  }
  const parsed = challengeVerifySchema.safeParse(body);
  if (!parsed.success || !pending) {
    return jsonStaffMfa({ error: "Invalid authentication code." }, 400);
  }

  try {
    const result = await verifyMfaChallenge({
      rawToken: pending,
      code: parsed.data.code,
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    const response = jsonStaffMfa({
      ok: true,
      mfaTicket: result.mfaTicket,
      recoveryUsed: result.recoveryUsed,
    });
    clearPendingCookie(response);
    applyElevationCookie(response, result.session.rawToken, result.session.expiresAt);
    return response;
  } catch (error) {
    return jsonStaffMfaError(error, "Invalid authentication code.");
  }
}

/** Logged-in staff re-challenge (idle elevation expired). */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonStaffMfa({ error: "Unauthorized." }, 401);
  }
  const userId = session.user.id;
  if (!(await userHasStaffIdentity(userId))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  if (!(await userHasActiveStaffMfa(userId))) {
    return jsonStaffMfa({ next: "enroll" });
  }
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`mfa-reauth:${userId}:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonStaffMfa({ error: "Too many attempts." }, 429);
  }
  try {
    const challenge = await createMfaChallenge({
      userId,
      purpose: CHALLENGE_PURPOSE.reauth,
      ip,
    });
    const response = jsonStaffMfa({ next: "mfa" });
    applyPendingCookie(response, challenge.rawToken);
    return response;
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}
