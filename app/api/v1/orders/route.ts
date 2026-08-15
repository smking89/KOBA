import { prisma } from "@/lib/db";
import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { requireApiKey } from "@/features/developers/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = await requireApiKey(request, "orders:read");
    const items = await prisma.devPurchase.findMany({
      where: { product: { profileId: key.application.profileId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        publicRef: true,
        status: true,
        priceCoins: true,
        createdAt: true,
        product: { select: { slug: true, name: true } },
      },
    });
    return jsonDeveloper({
      environment: key.environment,
      items: items.map((item) => ({
        publicRef: item.publicRef,
        status: item.status,
        priceCoins: item.priceCoins.toString(),
        productSlug: item.product.slug,
        productName: item.product.name,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not read orders.");
  }
}
