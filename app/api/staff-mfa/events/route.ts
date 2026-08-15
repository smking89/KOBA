import { auth } from "@/lib/auth";
import { jsonStaffMfa } from "@/features/staff-mfa/lib/http";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { listRecentStaffSecurityEvents } from "@/features/staff-mfa/services/staff-mfa.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return jsonStaffMfa({ error: "Unauthorized." }, 401);
  if (!(await userHasStaffIdentity(session.user.id))) {
    return jsonStaffMfa({ events: [] });
  }
  const events = await listRecentStaffSecurityEvents(session.user.id);
  return jsonStaffMfa({ events });
}
