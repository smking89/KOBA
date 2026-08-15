import { NextResponse } from "next/server";
import { parseCosmeticQuery } from "@/features/marketplace/schemas/cosmetic.schemas";
import { listPublicCosmetics } from "@/features/marketplace/services/cosmetic.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseCosmeticQuery(Object.fromEntries(url.searchParams.entries()));
  const result = await listPublicCosmetics(query);

  return NextResponse.json(result);
}
