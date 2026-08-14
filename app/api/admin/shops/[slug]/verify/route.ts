import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { staffVerifyShopSchema } from "@/features/shops/schemas/shop.schemas";
import { staffVerifyShop } from "@/features/shops/services/shop.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`admin-shop-verify:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many verification attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = staffVerifyShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const shop = await staffVerifyShop(
      session.user.id,
      slug,
      parsed.data.status,
      parsed.data.note,
      ip,
    );
    return NextResponse.json({ slug: shop.slug, status: shop.verificationStatus });
  } catch (error) {
    return jsonShopError(error, "Could not verify shop.");
  }
}
