import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ServerConnectWizard } from "@/features/servers/components/server-connect-wizard";
import { canConnectGameServer } from "@/features/servers/lib/types";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { listAccountServers } from "@/features/servers/services/server.service";

export const metadata = { title: "Connect Rust server" };

export default async function ServerConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/servers/connect");
  }
  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot || !canConnectGameServer(snapshot.activeAccountType)) {
    redirect("/servers");
  }
  const servers = await listAccountServers(session.user.id).catch(() => []);
  const params = await searchParams;
  return (
    <ServerConnectWizard
      initialServers={servers}
      {...(params.server ? { selectedSlug: params.server } : {})}
    />
  );
}
