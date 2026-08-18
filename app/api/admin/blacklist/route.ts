import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertStaffAal2 } from "@/features/staff-mfa/lib/assurance";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";
import {
  addPlatformBlacklistEntry,
  listPlatformBlacklist,
  PlatformBlacklistError,
} from "@/features/blacklist/services/platform-blacklist.service";
import { addPlatformBlacklistEntrySchema } from "@/features/blacklist/schemas/blacklist.schemas";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof PlatformBlacklistError) {
    const status =
      error.code === "FORBIDDEN" ? 403 : error.code === "CONFLICT" ? 409 : error.code === "INVALID" ? 400 : 404;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  try {
    await assertStaffAal2(session.user.id);
    const entries = await listPlatformBlacklist(session.user.id, {
      query: searchParams.get("q") ?? undefined,
      hashtag: searchParams.get("hashtag") ?? undefined,
      targetType:
        searchParams.get("targetType") === "SHOP"
          ? "SHOP"
          : searchParams.get("targetType") === "USER"
            ? "USER"
            : undefined,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    const mfa = staffMfaErrorResponse(error);
    if (mfa) return mfa;
    return errorResponse(error, "Could not load the platform blacklist.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = addPlatformBlacklistEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ban entry." }, { status: 400 });
  }

  try {
    await assertStaffAal2(session.user.id, { stepUp: true });
    const entry = await addPlatformBlacklistEntry(session.user.id, parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const mfa = staffMfaErrorResponse(error);
    if (mfa) return mfa;
    return errorResponse(error, "Could not issue platform ban.");
  }
}
