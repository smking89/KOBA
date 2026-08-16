import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonBoostError } from "@/features/boost/lib/http";
import { giftBoost } from "@/features/boost/services/boost.service";

const giftSchema = z.object({
  recipientUserId: z.string().trim().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`boost-gift:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many Boost gift attempts." }, { status: 429 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = giftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gift request." }, { status: 400 });
  }

  try {
    const boost = await giftBoost(
      session.user.id,
      id,
      parsed.data.recipientUserId,
      clientIp(request),
    );
    return NextResponse.json({ boost });
  } catch (error) {
    return jsonBoostError(error, "Could not gift this Boost.");
  }
}
