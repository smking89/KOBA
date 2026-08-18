import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import { equipShopBanner } from "@/features/koba-shop/services/cosmetic-equip.service";
import { KobaShopError, kobaShopErrorStatus } from "@/features/koba-shop/lib/errors";

export const dynamic = "force-dynamic";

const schema = z.object({ cosmeticOwnershipId: z.string().min(1) });

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    const equip = await equipShopBanner(shop.id, session.user.id, parsed.data.cosmeticOwnershipId);
    return NextResponse.json({ equip });
  } catch (error) {
    if (error instanceof KobaShopError) {
      return NextResponse.json({ error: error.message }, { status: kobaShopErrorStatus(error.code) });
    }
    return NextResponse.json({ error: "Could not equip shop banner." }, { status: 500 });
  }
}
