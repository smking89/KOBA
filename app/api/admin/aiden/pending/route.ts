import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAdminError } from "@/features/admin/lib/http";
import { listPendingAidenAssets } from "@/features/admin/services/admin.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const assets = await listPendingAidenAssets(session.user.id);
    return NextResponse.json({ assets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonAdminError(error, "Could not load pending Aiden assets.");
  }
}
