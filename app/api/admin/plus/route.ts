import { auth } from "@/lib/auth";
import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { adminPlusSearchSchema } from "@/features/plus/schemas/plus.schemas";
import { searchPlusSubscriptions } from "@/features/plus/services/plus-admin.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonPlus({ error: "Unauthorized." }, 401);
  }
  const url = new URL(request.url);
  const parsed = adminPlusSearchSchema.safeParse({ q: url.searchParams.get("q") ?? undefined });
  if (!parsed.success) {
    return jsonPlus({ error: "Invalid search." }, 400);
  }
  try {
    const subscriptions = await searchPlusSubscriptions(session.user.id, parsed.data.q);
    return jsonPlus({ subscriptions });
  } catch (error) {
    return jsonPlusError(error, "Could not search Plus subscriptions.");
  }
}
