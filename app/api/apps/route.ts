import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { searchPublicProducts } from "@/features/developers/services/developer.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pricing = searchParams.get("pricing");
  try {
    return jsonDeveloper({
      items: await searchPublicProducts({
        ...(searchParams.get("q") ? { q: searchParams.get("q") as string } : {}),
        ...(searchParams.get("category")
          ? { category: searchParams.get("category") as string }
          : {}),
        ...(searchParams.get("game") ? { game: searchParams.get("game") as string } : {}),
        ...(searchParams.get("platform")
          ? { platform: searchParams.get("platform") as string }
          : {}),
        ...(pricing === "FREE" || pricing === "PAID" ? { pricing } : {}),
      }),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not load app catalog.");
  }
}
