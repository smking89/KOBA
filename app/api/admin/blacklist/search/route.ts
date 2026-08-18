import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";
import {
  searchBlacklistShopCandidates,
  searchBlacklistUserCandidates,
} from "@/features/blacklist/lib/search";

export const dynamic = "force-dynamic";

/** Target search for the superadmin ban form — users via @handle/KOBAID/
 * shopname, or shops directly when banning a storefront itself. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const targetType = searchParams.get("targetType") === "SHOP" ? "SHOP" : "USER";

  try {
    await assertStaffAal2(session.user.id);
    const candidates =
      targetType === "SHOP"
        ? await searchBlacklistShopCandidates(query)
        : await searchBlacklistUserCandidates(query);
    return NextResponse.json({ candidates });
  } catch (error) {
    const mfa = staffMfaErrorResponse(error);
    if (mfa) return mfa;
    return NextResponse.json({ error: "Could not search." }, { status: 500 });
  }
}
