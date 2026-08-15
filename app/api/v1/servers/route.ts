import { prisma } from "@/lib/db";
import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { requireApiKey } from "@/features/developers/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = await requireApiKey(request, "servers:read");
    const servers = await prisma.gameServer.findMany({
      where: { publicationStatus: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        publicRef: true,
        slug: true,
        name: true,
        game: true,
        operationalStatus: true,
        region: true,
      },
    });
    return jsonDeveloper({ environment: key.environment, items: servers });
  } catch (error) {
    return jsonDeveloperError(error, "Could not read servers.");
  }
}
