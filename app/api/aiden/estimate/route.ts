import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { aidenEstimateSchema } from "@/features/aiden/schemas/aiden.schemas";
import { estimateJobCost, getAidenWalletPreview } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`aiden-estimate:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonAiden({ error: "Too many estimate requests." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonAiden({ error: "Invalid JSON body." }, 400);
  }
  const parsed = aidenEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonAiden({ error: "Invalid estimate request." }, 400);
  }
  try {
    const estimate = await estimateJobCost(parsed.data);
    const wallet = await getAidenWalletPreview(session.user.id);
    return jsonAiden({ estimate, wallet });
  } catch (error) {
    return jsonAidenError(error, "Could not estimate Aiden cost.");
  }
}
