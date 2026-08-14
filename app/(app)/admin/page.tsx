import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { isStaffAccountType } from "@/features/koba-id/lib/format";

export const metadata = { title: "Staff" };

export default async function AdminPlaceholderPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  const staffIdentities = snapshot.identities.filter((identity) =>
    isStaffAccountType(identity.accountType),
  );

  if (staffIdentities.length === 0) {
    redirect("/enter");
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="warning">Staff</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">KOBA staff</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Staff KOBAIDs are issued by Superadmin/Admin only. The full admin console lands in a later
          phase. Issuance API: <span className="font-mono text-xs">POST /api/admin/kobaid</span>
        </p>
      </div>
      <Card>
        <CardTitle>Assigned staff identities</CardTitle>
        <CardDescription>
          No badge icons — staff are identified by KOBAID format only.
        </CardDescription>
        <ul className="mt-3 space-y-2 font-mono text-sm">
          {staffIdentities.map((identity) => (
            <li key={identity.code}>{identity.code}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
