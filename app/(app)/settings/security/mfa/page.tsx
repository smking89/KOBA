import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { MfaEnrollForm } from "@/features/staff-mfa/components/mfa-enroll-form";

export const metadata = { title: "Staff MFA" };
export const dynamic = "force-dynamic";

export default async function StaffMfaSettingsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/settings/security/mfa");
  if (!(await userHasStaffIdentity(session.user.id))) redirect("/settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Staff authenticator</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Enrollment is not complete until a generated code is verified. The QR image is never
          stored.
        </p>
      </div>
      <MfaEnrollForm />
    </div>
  );
}
