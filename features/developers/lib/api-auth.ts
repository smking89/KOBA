import { authenticateApiKey } from "@/features/developers/services/portal.service";
import { DeveloperError } from "@/features/developers/lib/errors";
import { hasScope, type DevApiScope } from "@/features/developers/lib/scopes";
import { rateLimit } from "@/lib/security/rate-limit";

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function requireApiKey(request: Request, scope: DevApiScope) {
  const token = extractBearer(request);
  if (!token) throw new DeveloperError("API key required.", "FORBIDDEN");
  const key = await authenticateApiKey(token);
  if (!hasScope(key.scopes, scope)) {
    throw new DeveloperError("Insufficient API scope.", "FORBIDDEN");
  }
  const limited = await rateLimit(`dev-key:${key.prefix}`, key.rateLimitRpm, 60 * 1000);
  if (!limited.success) {
    throw new DeveloperError("API key rate limit exceeded.", "RATE_LIMITED");
  }
  return key;
}
