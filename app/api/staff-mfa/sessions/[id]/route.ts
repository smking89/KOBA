import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { jsonStaffMfa, jsonStaffMfaError } from "@/features/staff-mfa/lib/http";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { revokeStaffSession } from "@/features/staff-mfa/services/staff-session.service";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ error: "Staff only." }, 403);
  }
  const { id } = await context.params;
  try {
    const ok = await revokeStaffSession({
      userId: session.user.id,
      sessionId: id,
      reason: "revoke-one",
      ip: clientIp(request),
    });
    return jsonStaffMfa({ ok });
  } catch (error) {
    return jsonStaffMfaError(error);
  }
}
