import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { upsertCosmeticSchema } from "@/features/marketplace/schemas/cosmetic.schemas";
import { createSellerCosmetic } from "@/features/shops/services/cosmetic-admin.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`seller-cosmetic:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many cosmetic attempts." }, { status: 429 });
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

  try {
    const cosmetic = await createSellerCosmetic(session.user.id, parsed.data);
    return NextResponse.json(
      { slug: cosmetic.slug, moderationStatus: cosmetic.moderationStatus },
      { status: 201 },
    );
  } catch (error) {
    return jsonShopError(error, "Could not create cosmetic.");
  }
}
