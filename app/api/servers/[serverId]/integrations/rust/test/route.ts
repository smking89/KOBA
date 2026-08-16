import { rustTestSchema } from "@/features/servers/schemas/integration.schemas";
import { testRustConnection } from "@/features/servers/services/integration.service";
import {
  actorFromSession,
  integrationFail,
  integrationOk,
  limitIntegration,
  readJson,
  requestIp,
  requireIntegrationSession,
} from "@/features/servers/lib/integration-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const authz = await requireIntegrationSession();
  if (!authz.ok) return authz.response;
  const session = authz.session;
  const limited = await limitIntegration(session.user.id, "test", 20);
  if (limited) return limited;
  const parsed = await readJson(request, rustTestSchema);
  if (!parsed.ok) return parsed.response;
  const { serverId } = await context.params;
  try {
    const result = await testRustConnection(
      session.user.id,
      serverId,
      parsed.data,
      requestIp(request),
      actorFromSession(session),
    );
    return integrationOk(result);
  } catch (err) {
    return integrationFail(err, "Could not test Rust connection.");
  }
}
