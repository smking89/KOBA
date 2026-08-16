import { auth } from "@/lib/auth";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { getSubscriptionStatus } from "@/features/plus/services/plus.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  try {
    return jsonPlus(await getSubscriptionStatus(session.user.id));
  } catch (error) {
    return jsonPlusError(error, "Could not load Plus subscription.");
  }
}
