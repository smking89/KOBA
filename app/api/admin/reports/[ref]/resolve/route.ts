import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAdminError } from "@/features/admin/lib/http";
import { resolveReportSchema } from "@/features/admin/schemas/admin.schemas";
import { resolveReport } from "@/features/admin/services/admin.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`admin-report-resolve:${session.user.id}`, 60, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many report actions." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report resolution payload." }, { status: 400 });
  }

  const { ref } = await context.params;

  try {
    const result = await resolveReport(session.user.id, ref, parsed.data, ip);
    return NextResponse.json(result);
  } catch (error) {
    return jsonAdminError(error, "Could not resolve report.");
  }
}
