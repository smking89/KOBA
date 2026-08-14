import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonAdminError } from "@/features/admin/lib/http";
import { listPendingProducts } from "@/features/admin/services/admin.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const products = await listPendingProducts(session.user.id);
    return NextResponse.json({ products });
  } catch (error) {
    return jsonAdminError(error, "Could not load pending products.");
  }
}
