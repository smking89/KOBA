import { NextResponse } from "next/server";
import { getPublicCosmetic } from "@/features/marketplace/services/cosmetic.service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const cosmetic = await getPublicCosmetic(slug);

  if (!cosmetic) {
    return NextResponse.json({ error: "Cosmetic not found." }, { status: 404 });
  }

  return NextResponse.json({ cosmetic });
}
