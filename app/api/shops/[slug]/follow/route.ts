import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { toggleShopFollow } from "@/features/shops/services/shop.service";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to follow a shop." }, { status: 401 });
  }

  const limited = await rateLimit(`shop-follow:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many follow attempts." }, { status: 429 });
  }

  const { slug } = await context.params;

  try {
    const result = await toggleShopFollow(session.user.id, slug);
    return NextResponse.json(result);
  } catch (error) {
    return jsonShopError(error, "Could not update follow.");
  }
}
