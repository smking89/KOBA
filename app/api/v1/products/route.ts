import { prisma } from "@/lib/db";
import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { requireApiKey } from "@/features/developers/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = await requireApiKey(request, "products:read");
    const items = await prisma.devProduct.findMany({
      where: { profileId: key.application.profileId, reviewState: "PUBLISHED", suspendedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        publicRef: true,
        slug: true,
        name: true,
        category: true,
        pricing: true,
        priceCoins: true,
      },
    });
    return jsonDeveloper({
      environment: key.environment,
      items: items.map((item) => ({ ...item, priceCoins: item.priceCoins.toString() })),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not read products.");
  }
}
