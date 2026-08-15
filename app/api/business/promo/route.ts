import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonShopError } from "@/features/shops/lib/http";
import { promoConfigUpdateSchema } from "@/features/shops/schemas/shop.schemas";
import { getPromoConfig, updatePromoConfig } from "@/features/shops/services/promo.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const promoConfig = await getPromoConfig(session.user.id);
    return NextResponse.json({ promoConfig });
  } catch (error) {
    return jsonShopError(error, "Could not load promo settings.");
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = promoConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promo config." }, { status: 400 });
  }

  try {
    const promoConfig = await updatePromoConfig(session.user.id, parsed.data);
    return NextResponse.json({ promoConfig });
  } catch (error) {
    return jsonShopError(error, "Could not update promo settings.");
  }
}
