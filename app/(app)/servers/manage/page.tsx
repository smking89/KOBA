import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ServerRegisterForm } from "@/features/servers/components/server-register-form";
import { canConnectGameServer } from "@/features/servers/lib/types";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { listAccountServers } from "@/features/servers/services/server.service";

export const metadata = { title: "Manage servers" };

export default async function ManageServersPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/servers/manage");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot || !canConnectGameServer(snapshot.activeAccountType)) {
    redirect("/servers");
  }

  const servers = await listAccountServers(session.user.id).catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/servers" className="text-sm text-muted hover:text-foreground">
          ← Directory
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage servers</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Active mode: {snapshot.activeAccountType}. Only servers owned by this KOBA account appear
          here. RCON credentials are deferred to Phase 14E.
        </p>
      </div>

      <ServerRegisterForm />

      <Card>
        <CardTitle>Your servers</CardTitle>
        <CardDescription>Drafts, pending verification, and published listings.</CardDescription>
        <ul className="mt-4 space-y-3">
          {servers.length === 0 ? (
            <li className="text-sm text-muted">No servers for this account yet.</li>
          ) : (
            servers.map((server) => (
              <li key={server.publicRef} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-sm last:border-0">
                <div>
                  <Link href={`/servers/${server.slug}`} className="font-medium text-neon-mint">
                    {server.name}
                  </Link>
                  <div className="text-muted">
                    {server.game} · {server.verificationStatus} · {server.publicationStatus}
                  </div>
                </div>
                <span className="font-mono text-xs text-muted">{server.publicRef}</span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
