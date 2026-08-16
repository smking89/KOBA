import { auth } from "@/lib/auth";
import { jsonInfluencer } from "@/features/influencer/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";

export async function requireInfluencerSession(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user.id) {
    return { ok: false, response: jsonInfluencer({ error: "Unauthorized." }, 401) };
  }
  return { ok: true, userId: session.user.id };
}

export async function limitInfluencer(key: string, limit = 20) {
  const limited = await rateLimit(key, limit, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonInfluencer({ error: "Too many attempts." }, 429);
  }
  return null;
}

export async function readJsonBody(request: Request) {
  try {
    return { body: (await request.json()) as unknown, error: null as Response | null };
  } catch {
    return { body: null, error: jsonInfluencer({ error: "Invalid JSON body." }, 400) };
  }
}
