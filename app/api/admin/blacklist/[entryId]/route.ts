import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";
import {
  PlatformBlacklistError,
  removePlatformBlacklistEntry,
} from "@/features/blacklist/services/platform-blacklist.service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { entryId } = await params;

  try {
    await assertStaffAal2(session.user.id, { stepUp: true });
    await removePlatformBlacklistEntry(session.user.id, entryId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    const mfa = staffMfaErrorResponse(error);
    if (mfa) return mfa;
    if (error instanceof PlatformBlacklistError) {
      const status = error.code === "FORBIDDEN" ? 403 : 404;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Could not lift platform ban." }, { status: 500 });
  }
}
