import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPendingKobaShopApplications } from "@/features/koba-shop/services/application.service";
import { KobaShopError, kobaShopErrorStatus } from "@/features/koba-shop/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const applications = await listPendingKobaShopApplications(session.user.id);
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof KobaShopError) {
      return NextResponse.json({ error: error.message }, { status: kobaShopErrorStatus(error.code) });
    }
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }
}
