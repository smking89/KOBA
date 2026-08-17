import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { SaveError, toggleProductSave } from "@/features/marketplace/services/save.service";

const bodySchema = z.object({
  slug: z.string().trim().min(1).max(96),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to save listings to your wishlist." }, { status: 401 });
  }

  const limited = await rateLimit(`product-save:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many save attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  }

  try {
    const result = await toggleProductSave(session.user.id, parsed.data.slug);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SaveError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update your wishlist." }, { status: 500 });
  }
}
