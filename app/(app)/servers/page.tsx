import { ServerDirectory } from "@/features/servers/components/server-directory";
import { listDirectory } from "@/features/servers/services/server.service";
import { auth } from "@/lib/auth";

export const metadata = { title: "Servers" };

export default async function ServersPage() {
  const session = await auth();
  const result = await listDirectory({ limit: 48 }, session?.user.id ?? null).catch(() => ({
    items: [],
    nextCursor: null,
  }));
  return <ServerDirectory initialServers={result.items} />;
}
