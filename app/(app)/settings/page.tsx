import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge>Signed in</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Signed in as {session.user.email ?? session.user.name}. KOBAID minting and account mode
          switching arrive in Phase 4.
        </p>
      </div>
      <Card>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          User ID: <span className="font-mono text-xs">{session.user.id}</span>
        </CardDescription>
      </Card>
      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Technical light tokens may exist later for tooling, but KOBA ships dark-first.
        </CardDescription>
      </Card>
    </div>
  );
}
