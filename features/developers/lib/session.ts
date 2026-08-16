import { auth } from "@/lib/auth";
import { jsonDeveloper } from "@/features/developers/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";

export async function requireDeveloperSession(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user.id) {
    return { ok: false, response: jsonDeveloper({ error: "Unauthorized." }, 401) };
  }
  return { ok: true, userId: session.user.id };
}

export async function limitDeveloper(key: string, limit = 20) {
  const limited = await rateLimit(key, limit, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonDeveloper({ error: "Too many attempts." }, 429);
  }
  return null;
}

export async function readJsonBody(request: Request) {
  try {
    return { body: (await request.json()) as unknown, error: null as Response | null };
  } catch {
    return { body: null, error: jsonDeveloper({ error: "Invalid JSON body." }, 400) };
  }
}
