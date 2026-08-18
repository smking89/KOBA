import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import { submitKobaShopApplication } from "@/features/koba-shop/services/application.service";
import { KobaShopError, kobaShopErrorStatus } from "@/features/koba-shop/lib/errors";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const shop = await getOwnedShop(session.user.id);
  if (!shop) return NextResponse.json({ error: "You don't own a shop." }, { status: 404 });

  try {
    const application = await submitKobaShopApplication(shop.id, session.user.id);
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof KobaShopError) {
      return NextResponse.json({ error: error.message }, { status: kobaShopErrorStatus(error.code) });
    }
    return NextResponse.json({ error: "Could not submit application." }, { status: 500 });
  }
}
