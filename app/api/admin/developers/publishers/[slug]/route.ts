import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { jsonAdminError } from "@/features/admin/lib/http";
import {
  suspendDeveloperPublisher,
  verifyDeveloperPublisher,
} from "@/features/developers/services/moderation.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    action: z.enum(["verify", "suspend"]),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid publisher action." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { slug } = await context.params;
  try {
    const result =
      parsed.data.action === "verify"
        ? await verifyDeveloperPublisher(
            session.user.id,
            slug,
            parsed.data.reason,
            clientIp(request),
          )
        : await suspendDeveloperPublisher(
            session.user.id,
            slug,
            parsed.data.reason,
            clientIp(request),
          );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonAdminError(error, "Could not update publisher.");
  }
}
