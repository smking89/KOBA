import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonShopError } from "@/features/shops/lib/http";
import { shopReviewSchema } from "@/features/shops/schemas/shop.schemas";
import { addShopReview } from "@/features/shops/services/shop.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to review a shop." }, { status: 401 });
  }

  const limited = await rateLimit(`shop-review:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many review attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = shopReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    await addShopReview(session.user.id, slug, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonShopError(error, "Could not save review.");
  }
}
