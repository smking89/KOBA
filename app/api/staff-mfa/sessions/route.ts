import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { STAFF_ELEVATION_COOKIE } from "@/features/staff-mfa/lib/config";
import { clearStaffMfaCookies } from "@/features/staff-mfa/lib/cookies";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { readElevationCookie } from "@/features/staff-mfa/lib/assurance";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import {
  listStaffSessions,
  revokeAllStaffSessions,
  revokeStaffSession,
} from "@/features/staff-mfa/services/staff-session.service";
import { notifyStaffSecurity } from "@/features/staff-mfa/lib/notifications";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  const current = await readElevationCookie();
  const rows = await listStaffSessions(session.user.id, current);
  return jsonStaffMfa({ sessions: rows });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  const limited = await rateLimit(`mfa-sessions:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) return jsonStaffMfa({ error: "Too many attempts." }, 429);

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const current = await readElevationCookie();

  try {
    if (all) {
      const currentRow = current
        ? (await listStaffSessions(session.user.id, current)).find((row) => row.current)
        : null;
      await revokeAllStaffSessions({
        userId: session.user.id,
        reason: "logout-all",
        ...(currentRow?.id ? { exceptSessionId: currentRow.id } : {}),
        ip: clientIp(request),
      });
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });
      await notifyStaffSecurity(user?.email, "KOBA staff sessions revoked", [
        "All other staff privileged sessions were signed out.",
      ]);
      return jsonStaffMfa({ ok: true });
    }

    const store = await cookies();
    const raw = store.get(STAFF_ELEVATION_COOKIE)?.value;
    if (raw) {
      const rows = await listStaffSessions(session.user.id, raw);
      const currentRow = rows.find((row) => row.current);
      if (currentRow) {
        await revokeStaffSession({
          userId: session.user.id,
          sessionId: currentRow.id,
          reason: "logout",
          ip: clientIp(request),
        });
      }
    }
    const response = jsonStaffMfa({ ok: true });
    clearStaffMfaCookies(response);
    return response;
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}
