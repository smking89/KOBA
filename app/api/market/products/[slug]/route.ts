import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicProduct } from "@/features/marketplace/services/product.service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const session = await auth();
  const product = await getPublicProduct(slug, session?.user.id);

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ product });
}
