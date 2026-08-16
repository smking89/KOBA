import { auth } from "@/lib/auth";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { listLibrary } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  try {
    return jsonAiden({ items: await listLibrary(session.user.id) });
  } catch (error) {
    return jsonAidenError(error, "Could not load Aiden library.");
  }
}
