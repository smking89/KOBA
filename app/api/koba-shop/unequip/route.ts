import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unequipCosmetic } from "@/features/koba-shop/services/cosmetic-equip.service";
import { KobaShopError, kobaShopErrorStatus } from "@/features/koba-shop/lib/errors";
import { unequipCosmeticSchema } from "@/features/koba-shop/schemas/koba-shop.schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = unequipCosmeticSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    await unequipCosmetic(session.user.id, parsed.data.subType);
    return NextResponse.json({ unequipped: true });
  } catch (error) {
    if (error instanceof KobaShopError) {
      return NextResponse.json({ error: error.message }, { status: kobaShopErrorStatus(error.code) });
    }
    return NextResponse.json({ error: "Could not unequip." }, { status: 500 });
  }
}
