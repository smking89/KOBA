import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { submitSellerProduct } from "@/features/shops/services/product-admin.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`seller-submit:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many submit attempts." }, { status: 429 });
  }

  const { slug } = await context.params;

  try {
    const product = await submitSellerProduct(session.user.id, slug, ip);
    return NextResponse.json({
      slug: product.slug,
      moderationStatus: product.moderationStatus,
    });
  } catch (error) {
    return jsonShopError(error, "Could not submit listing.");
  }
}
