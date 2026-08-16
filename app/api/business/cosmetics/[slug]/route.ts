import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { upsertCosmeticSchema } from "@/features/marketplace/schemas/cosmetic.schemas";
import { updateSellerCosmetic } from "@/features/shops/services/cosmetic-admin.service";

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`seller-cosmetic-update:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many cosmetic updates." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = upsertCosmeticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cosmetic." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const cosmetic = await updateSellerCosmetic(session.user.id, slug, parsed.data);
    return NextResponse.json({
      slug: cosmetic.slug,
      moderationStatus: cosmetic.moderationStatus,
    });
  } catch (error) {
    return jsonShopError(error, "Could not update cosmetic.");
  }
}
