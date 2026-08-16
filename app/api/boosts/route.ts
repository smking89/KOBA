import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonBoostError } from "@/features/boost/lib/http";
import {
  listMyBoosts,
  newBoostIdempotencyKey,
  purchaseBoost,
} from "@/features/boost/services/boost.service";

const purchaseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const boosts = await listMyBoosts(session.user.id);
  return NextResponse.json({ boosts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`boost-purchase:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many Boost purchase attempts." }, { status: 429 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine, idempotencyKey defaults below
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid purchase request." }, { status: 400 });
  }

  try {
    const boost = await purchaseBoost(
      session.user.id,
      parsed.data.idempotencyKey ?? newBoostIdempotencyKey(),
      clientIp(request),
    );
    return NextResponse.json({ boost });
  } catch (error) {
    return jsonBoostError(error, "Could not purchase a Boost.");
  }
}
