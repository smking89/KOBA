import { auth } from "@/lib/auth";
import { jsonStaffMfa } from "@/features/staff-mfa/lib/http";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { getStaffMfaStatus } from "@/features/staff-mfa/services/staff-mfa.service";
import { readElevationCookie } from "@/features/staff-mfa/lib/assurance";
import { getActiveElevation } from "@/features/staff-mfa/services/staff-session.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ staff: false });
  }
  const status = await getStaffMfaStatus(session.user.id);
  const raw = await readElevationCookie();
  const elevation = raw ? await getActiveElevation(session.user.id, raw) : null;
  return jsonStaffMfa({
    staff: true,
    ...status,
    aal: elevation ? "AAL2" : "AAL1",
    stepUpFresh: elevation?.stepUpFresh ?? false,
  });
}
