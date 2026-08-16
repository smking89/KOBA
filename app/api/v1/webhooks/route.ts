import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { requireApiKey } from "@/features/developers/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = await requireApiKey(request, "webhooks:manage");
    const items = await prisma.developerWebhookEndpoint.findMany({
      where: { profileId: key.application.profileId },
      orderBy: { createdAt: "desc" },
      select: {
        publicRef: true,
        url: true,
        events: true,
        secretPrefix: true,
        disabledAt: true,
      },
    });
    return jsonDeveloper({
      environment: key.environment,
      items: items.map((item) => ({
        publicRef: item.publicRef,
        url: item.url,
        events: item.events,
        secretPrefix: item.secretPrefix,
        disabled: Boolean(item.disabledAt),
        secret: null,
      })),
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not read webhooks.");
  }
}
