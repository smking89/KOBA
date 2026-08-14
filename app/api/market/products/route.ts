import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseMarketQuery } from "@/features/marketplace/schemas/market.schemas";
import { listPublicProducts } from "@/features/marketplace/services/product.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseMarketQuery(Object.fromEntries(url.searchParams.entries()));
  const session = await auth();
  const result = await listPublicProducts(query, session?.user.id);

  return NextResponse.json(result);
}
