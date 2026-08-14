import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { upsertProductSchema } from "@/features/shops/schemas/shop.schemas";
import { updateSellerProduct } from "@/features/shops/services/product-admin.service";

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = rateLimit(`seller-product-update:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many listing updates." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = upsertProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const product = await updateSellerProduct(session.user.id, slug, parsed.data);
    return NextResponse.json({
      slug: product.slug,
      moderationStatus: product.moderationStatus,
    });
  } catch (error) {
    return jsonShopError(error, "Could not update listing.");
  }
}
