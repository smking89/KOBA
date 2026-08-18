import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import { searchBlacklistUserCandidates } from "@/features/blacklist/lib/search";

export const dynamic = "force-dynamic";

/** Target search for the "add to blacklist" form — @handle, KOBAID
 * code, or a shop name/slug resolved to its owner. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const shop = await getOwnedShop(session.user.id);
  if (!shop) return NextResponse.json({ error: "You don't own a shop." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const candidates = await searchBlacklistUserCandidates(query);
  return NextResponse.json({ candidates });
}
