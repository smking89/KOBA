import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAdminError } from "@/features/admin/lib/http";
import { staffReviewAidenAsset } from "@/features/admin/services/admin.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limited = await rateLimit(`admin-aiden-review:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many review attempts." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review action." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { ref } = await context.params;
  try {
    const result = await staffReviewAidenAsset(
      session.user.id,
      ref,
      parsed.data.action,
      clientIp(request),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonAdminError(error, "Could not review Aiden asset.");
  }
}
