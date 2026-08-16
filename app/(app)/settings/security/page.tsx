import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { userHasStaffIdentity } from "@/features/staff-mfa/lib/staff-user";
import { SecurityOverview } from "@/features/staff-mfa/components/security-overview";

export const metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?callbackUrl=/settings/security");
  const staff = await userHasStaffIdentity(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {staff
            ? "Staff authenticator, recovery codes, and privileged sessions."
            : "Staff security controls are available only on staff accounts."}
        </p>
        <p className="mt-2 text-sm">
          <Link href="/settings" className="text-neon-lime hover:underline">
            Back to settings
          </Link>
        </p>
      </div>
      <SecurityOverview />
    </div>
  );
}
