import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { createShopSchema } from "@/features/shops/schemas/shop.schemas";
import { createShop } from "@/features/shops/services/shop.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to create a shop." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`shop-create:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many shop create attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shop details." }, { status: 400 });
  }

  try {
    const shop = await createShop(session.user.id, parsed.data, ip);
    return NextResponse.json({ slug: shop.slug, name: shop.name }, { status: 201 });
  } catch (error) {
    return jsonShopError(error, "Could not create shop.");
  }
}
