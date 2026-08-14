import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { upsertProductSchema } from "@/features/shops/schemas/shop.schemas";
import { createSellerProduct } from "@/features/shops/services/product-admin.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = rateLimit(`seller-product:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many listing attempts." }, { status: 429 });
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

  try {
    const product = await createSellerProduct(session.user.id, parsed.data);
    return NextResponse.json(
      { slug: product.slug, moderationStatus: product.moderationStatus },
      { status: 201 },
    );
  } catch (error) {
    return jsonShopError(error, "Could not create listing.");
  }
}
