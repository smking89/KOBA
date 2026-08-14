import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAdminError } from "@/features/admin/lib/http";
import { getAdminOverview } from "@/features/admin/services/admin.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const overview = await getAdminOverview(session.user.id);
    return NextResponse.json(overview);
  } catch (error) {
    return jsonAdminError(error, "Could not load staff overview.");
  }
}
