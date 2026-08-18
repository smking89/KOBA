import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reviewKobaShopApplication } from "@/features/koba-shop/services/application.service";
import { KobaShopError, kobaShopErrorStatus } from "@/features/koba-shop/lib/errors";
import { reviewApplicationSchema } from "@/features/koba-shop/schemas/koba-shop.schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { applicationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = reviewApplicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    const application = await reviewKobaShopApplication(
      session.user.id,
      applicationId,
      parsed.data.decision,
      parsed.data.note,
    );
    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof KobaShopError) {
      return NextResponse.json({ error: error.message }, { status: kobaShopErrorStatus(error.code) });
    }
    return NextResponse.json({ error: "Could not review application." }, { status: 500 });
  }
}
