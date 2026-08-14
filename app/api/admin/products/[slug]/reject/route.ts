import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAdminError } from "@/features/admin/lib/http";
import { rejectProductSchema } from "@/features/admin/schemas/admin.schemas";
import { staffRejectProduct } from "@/features/admin/services/admin.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`admin-product-reject:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many rejection attempts." }, { status: 429 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = rejectProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rejection payload." }, { status: 400 });
  }

  const { slug } = await context.params;

  try {
    const product = await staffRejectProduct(session.user.id, slug, parsed.data.note, ip);
    return NextResponse.json({
      slug: product.slug,
      moderationStatus: product.moderationStatus,
    });
  } catch (error) {
    return jsonAdminError(error, "Could not reject listing.");
  }
}
