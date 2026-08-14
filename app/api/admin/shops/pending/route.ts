import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAdminError } from "@/features/admin/lib/http";
import { listPendingShops } from "@/features/admin/services/admin.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const shops = await listPendingShops(session.user.id);
    return NextResponse.json({ shops });
  } catch (error) {
    return jsonAdminError(error, "Could not load pending shops.");
  }
}
