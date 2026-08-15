import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { SessionsPanel } from "@/features/staff-mfa/components/sessions-panel";

export const metadata = { title: "Staff sessions" };
export const dynamic = "force-dynamic";

export default async function StaffSessionsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/settings/security/sessions");
  if (!(await userHasStaffIdentity(session.user.id))) redirect("/settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Privileged sessions</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Revoking a session drops AAL2 immediately. Your public KOBA login is separate.
        </p>
      </div>
      <SessionsPanel />
    </div>
  );
}
