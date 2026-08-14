import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { issueStaffKobaIdSchema } from "@/features/accounts/schemas/account.schemas";
import { KobaIdError, mintStaffKobaId } from "@/features/koba-id/services/mint.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`admin-kobaid:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many issuance attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = issueStaffKobaIdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff issuance payload." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    const identity = await mintStaffKobaId({
      actorUserId: session.user.id,
      targetUserId: target.id,
      accountType: parsed.data.accountType,
      ipAddress: ip,
    });

    return NextResponse.json(
      { ok: true, code: identity.code, accountType: identity.accountType },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof KobaIdError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not issue staff KOBAID." }, { status: 500 });
  }
}
