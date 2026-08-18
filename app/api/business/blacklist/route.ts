import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import {
  addShopBlacklistEntry,
  BlacklistError,
  listShopBlacklist,
} from "@/features/blacklist/services/shop-blacklist.service";
import { addShopBlacklistEntrySchema } from "@/features/blacklist/schemas/blacklist.schemas";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BlacklistError) {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "CONFLICT" ? 409 : error.code === "INVALID" ? 400 : 404;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const shop = await getOwnedShop(session.user.id);
  if (!shop) return NextResponse.json({ error: "You don't own a shop." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  try {
    const entries = await listShopBlacklist(shop.id, session.user.id, {
      query: searchParams.get("q") ?? undefined,
      hashtag: searchParams.get("hashtag") ?? undefined,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    return errorResponse(error, "Could not load blacklist.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const shop = await getOwnedShop(session.user.id);
  if (!shop) return NextResponse.json({ error: "You don't own a shop." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = addShopBlacklistEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid blacklist entry." }, { status: 400 });
  }

  try {
    const entry = await addShopBlacklistEntry(shop.id, session.user.id, parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not add blacklist entry.");
  }
}
