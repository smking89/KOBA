import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import { BlacklistError, removeShopBlacklistEntry } from "@/features/blacklist/services/shop-blacklist.service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const shop = await getOwnedShop(session.user.id);
  if (!shop) return NextResponse.json({ error: "You don't own a shop." }, { status: 404 });

  const { entryId } = await params;

  try {
    await removeShopBlacklistEntry(shop.id, session.user.id, entryId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof BlacklistError) {
      const status = error.code === "FORBIDDEN" ? 403 : 404;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Could not remove blacklist entry." }, { status: 500 });
  }
}
