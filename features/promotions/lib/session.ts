import { auth } from "@/lib/auth";
import { jsonPromotion } from "@/features/promotions/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { PromotionError } from "@/features/promotions/lib/errors";

export async function requireSignedIn(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user.id) {
    return { ok: false, response: jsonPromotion({ error: "Unauthorized." }, 401) };
  }
  return { ok: true, userId: session.user.id };
}

export async function requireActiveAccount(userId: string, type: "INFLUENCER" | "BUSINESS") {
  const snapshot = await getAccountSnapshot(userId);
  if (!snapshot) {
    throw new PromotionError("Account not found.", "NOT_FOUND");
  }
  if (snapshot.activeAccountType !== type) {
    throw new PromotionError(
      type === "INFLUENCER"
        ? "Switch to Influencer mode to continue."
        : "Switch to Business mode to continue.",
      "FORBIDDEN",
    );
  }
  return snapshot;
}

export async function limitPromotion(key: string, limit = 20, windowMs = 15 * 60 * 1000) {
  const limited = await rateLimit(key, limit, windowMs);
  if (!limited.success) {
    return jsonPromotion({ error: "Too many attempts." }, 429);
  }
  return null;
}

export async function readJsonBody(request: Request) {
  try {
    return { body: (await request.json()) as unknown, error: null as Response | null };
  } catch {
    return { body: null, error: jsonPromotion({ error: "Invalid JSON body." }, 400) };
  }
}
