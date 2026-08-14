import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicAuction } from "@/features/auctions/services/auction.service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await context.params;
  const auction = await getPublicAuction(slug, session?.user.id);
  if (!auction) {
    return NextResponse.json({ error: "Auction not found." }, { status: 404 });
  }
  return NextResponse.json(auction);
}
