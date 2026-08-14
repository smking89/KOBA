import { ServerDirectory } from "@/features/servers/components/server-directory";
import { listDirectory } from "@/features/servers/services/server.service";

export const metadata = { title: "Servers" };

export default async function ServersPage() {
  const initialServers = await listDirectory().catch(() => []);
  return <ServerDirectory initialServers={initialServers} />;
}
